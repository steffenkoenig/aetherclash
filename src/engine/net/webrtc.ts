// src/engine/net/webrtc.ts
// WebRTC DataChannel setup for real-time game input exchange.
//
// DataChannel configuration:
//   ordered: false        — discard stale packets; never queue old ones
//   maxRetransmits: 0     — no retransmission (rollback handles gaps)
//
// Packet formats:
//   Regular (6 bytes):   [uint32 frame][uint16 inputs]
//   Checksum (10 bytes): [uint32 frame][uint16 inputs][uint32 checksum]
//                        Sent every 60 frames for desync detection.

import type { PackedInputState } from '../input/keyboard.js';
import type { InputPacket } from './rollback.js';

// ── Constants ─────────────────────────────────────────────────────────────────

/** Frames between CRC32 checksum packets (1 second at 60 Hz). */
export const CHECKSUM_INTERVAL = 60;

/** Regular packet size in bytes: uint32 + uint16. */
export const REGULAR_PACKET_BYTES = 6;

/** Checksum packet size in bytes: uint32 + uint16 + uint32. */
export const CHECKSUM_PACKET_BYTES = 10;

// ── STUN servers (development defaults) ──────────────────────────────────────

const ICE_SERVERS: RTCIceServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
];

// ── WebRTC peer connection ────────────────────────────────────────────────────

export class GamePeerConnection {
  private readonly pc: RTCPeerConnection;
  private channel: RTCDataChannel | null = null;

  /** Pre-allocated send buffers (avoid allocation in hot path). */
  private readonly regularBuf  = new ArrayBuffer(REGULAR_PACKET_BYTES);
  private readonly checksumBuf = new ArrayBuffer(CHECKSUM_PACKET_BYTES);

  /** Round-trip time in milliseconds (updated by ping/pong). */
  public rtt = 0;

  /** Running packet loss estimate (packets lost / packets sent). */
  public packetLoss = 0;

  private sentPackets   = 0;
  private lostPackets   = 0;

  /** Fired when an InputPacket is received from the opponent. */
  public onInput: ((packet: InputPacket) => void) | null = null;

  /** Fired when the connection is ready to send/receive. */
  public onConnected: (() => void) | null = null;

  /** Fired when the connection closes or errors. */
  public onDisconnected: (() => void) | null = null;

  constructor() {
    this.pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    this.pc.onicecandidate = null; // set by caller after construction
    this.pc.onconnectionstatechange = () => this.handleConnectionStateChange();
  }

  // ── Host-side: create offer ───────────────────────────────────────────────

  /**
   * Create the DataChannel and generate an SDP offer.
   * Call this on the "host" peer (the one who created the match).
   */
  async createOffer(): Promise<RTCSessionDescriptionInit> {
    this.channel = this.pc.createDataChannel('game', {
      ordered:        false,
      maxRetransmits: 0,
    });
    this.setupChannel(this.channel);

    const offer = await this.pc.createOffer();
    await this.pc.setLocalDescription(offer);
    return offer;
  }

  // ── Guest-side: accept offer ──────────────────────────────────────────────

  /**
   * Set the remote SDP offer received from the host and generate an answer.
   * The guest listens for the DataChannel via `ondatachannel`.
   */
  async acceptOffer(offer: RTCSessionDescriptionInit): Promise<RTCSessionDescriptionInit> {
    this.pc.ondatachannel = (ev) => {
      this.channel = ev.channel;
      this.setupChannel(this.channel);
    };

    await this.pc.setRemoteDescription(offer);
    const answer = await this.pc.createAnswer();
    await this.pc.setLocalDescription(answer);
    return answer;
  }

  /** Apply the opponent's SDP answer (host only). */
  async acceptAnswer(answer: RTCSessionDescriptionInit): Promise<void> {
    await this.pc.setRemoteDescription(answer);
  }

  /** Add an ICE candidate received from the signalling server. */
  async addIceCandidate(candidate: RTCIceCandidateInit): Promise<void> {
    await this.pc.addIceCandidate(new RTCIceCandidate(candidate));
  }

  /** Register a callback that the caller wires up to the signalling server. */
  set onIceCandidate(cb: ((candidate: RTCIceCandidate) => void) | null) {
    this.pc.onicecandidate = cb
      ? (ev) => { if (ev.candidate) cb(ev.candidate); }
      : null;
  }

  // ── Sending ───────────────────────────────────────────────────────────────

  /**
   * Send the local input for `frame`.
   * Every `CHECKSUM_INTERVAL` frames, append the CRC32 checksum.
   */
  sendInput(frame: number, inputs: PackedInputState, checksum?: number): void {
    if (!this.channel || this.channel.readyState !== 'open') return;

    const includeChecksum = checksum !== undefined
      && (frame % CHECKSUM_INTERVAL) === 0;

    if (includeChecksum && checksum !== undefined) {
      const view = new DataView(this.checksumBuf);
      view.setUint32(0, frame   >>> 0, true);
      view.setUint16(4, inputs  & 0xFFFF, true);
      view.setUint32(6, checksum >>> 0, true);
      this.channel.send(this.checksumBuf);
    } else {
      const view = new DataView(this.regularBuf);
      view.setUint32(0, frame  >>> 0, true);
      view.setUint16(4, inputs & 0xFFFF, true);
      this.channel.send(this.regularBuf);
    }

    this.sentPackets++;
  }

  /** Send a ping to measure RTT. */
  sendPing(): void {
    if (!this.channel || this.channel.readyState !== 'open') return;
    const buf = new ArrayBuffer(5);
    const view = new DataView(buf);
    view.setUint8(0, 0xFF); // ping marker
    view.setFloat32(1, performance.now(), true);
    this.channel.send(buf);
  }

  /** Close the peer connection. */
  close(): void {
    this.channel?.close();
    this.pc.close();
  }

  // ── Private ───────────────────────────────────────────────────────────────

  private setupChannel(ch: RTCDataChannel): void {
    ch.binaryType = 'arraybuffer';

    ch.onopen = () => {
      this.onConnected?.();
    };

    ch.onclose = () => {
      this.onDisconnected?.();
    };

    ch.onerror = () => {
      this.onDisconnected?.();
    };

    ch.onmessage = (ev: MessageEvent<ArrayBuffer>) => {
      this.handleMessage(ev.data);
    };
  }

  private handleMessage(buf: ArrayBuffer): void {
    // Ping response (pong): 5 bytes, first byte 0xFF
    if (buf.byteLength === 5) {
      const view = new DataView(buf);
      if (view.getUint8(0) === 0xFF) {
        const sentAt = view.getFloat32(1, true);
        this.rtt = performance.now() - sentAt;
        return;
      }
    }

    // Regular input packet: 6 bytes
    if (buf.byteLength === REGULAR_PACKET_BYTES) {
      const view = new DataView(buf);
      const packet: InputPacket = {
        frame:  view.getUint32(0, true),
        inputs: view.getUint16(4, true),
      };
      this.onInput?.(packet);
      return;
    }

    // Checksum input packet: 10 bytes
    if (buf.byteLength === CHECKSUM_PACKET_BYTES) {
      const view = new DataView(buf);
      const packet: InputPacket = {
        frame:    view.getUint32(0, true),
        inputs:   view.getUint16(4, true),
        checksum: view.getUint32(6, true),
      };
      this.onInput?.(packet);
      return;
    }
  }

  private handleConnectionStateChange(): void {
    const state = this.pc.connectionState;
    if (state === 'disconnected' || state === 'failed' || state === 'closed') {
      this.onDisconnected?.();
    }
  }

  // ── Packet-loss estimate ──────────────────────────────────────────────────

  /**
   * Update the packet-loss estimate.  Call once per received input packet to
   * keep the running estimate fresh (uses EWMA with α = 0.05).
   */
  recordReceivedPacket(frameGap: number): void {
    const dropped = Math.max(0, frameGap - 1);
    this.lostPackets += dropped;
    this.sentPackets = Math.max(this.sentPackets, this.lostPackets + 1);
    this.packetLoss =
      this.packetLoss * 0.95 + (dropped > 0 ? 0.05 : 0);
  }

  /**
   * Compute the recommended input delay (0–3 frames) based on current RTT.
   *
   * | RTT (ms)  | Input Delay |
   * | <60       | 0 frames    |
   * | 60–120    | 1 frame     |
   * | 120–180   | 2 frames    |
   * | >180      | 3 frames    |
   */
  get recommendedInputDelay(): number {
    if (this.rtt < 60)  return 0;
    if (this.rtt < 120) return 1;
    if (this.rtt < 180) return 2;
    return 3;
  }
}
