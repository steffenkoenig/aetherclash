// src/engine/net/websocket.ts
// Browser-side WebSocket signalling client.
//
// Handles the full signalling flow:
//   1. connect()      — open the WebSocket and authenticate (anon or JWT)
//   2. findMatch()    — enter the matchmaking queue
//   3. On match_found — relay SDP offer/answer and ICE candidates via the server
//   4. On WebRTC DataChannel established — signalling no longer needed
//
// All message types mirror the server's protocol defined in server/signalling.ts
// and documented in docs/technical/networking.md.

// ── Message types ─────────────────────────────────────────────────────────────

export interface MatchFoundPayload {
  matchId: string;
  opponentId: string;
  seed: number;
  isHost: boolean;
}

interface BaseMsg { type: string }

interface MatchFoundMsg extends BaseMsg {
  type: 'match_found';
  payload: MatchFoundPayload;
}

interface RtcOfferMsg extends BaseMsg {
  type: 'rtc_offer';
  payload: { matchId: string; sdp: RTCSessionDescriptionInit };
}

interface RtcAnswerMsg extends BaseMsg {
  type: 'rtc_answer';
  payload: { matchId: string; sdp: RTCSessionDescriptionInit };
}

interface IceCandidateMsg extends BaseMsg {
  type: 'ice_candidate';
  payload: { matchId: string; candidate: RTCIceCandidateInit };
}

interface PongMsg extends BaseMsg {
  type: 'pong';
  payload: { timestamp: number };
}

type InboundMessage =
  | MatchFoundMsg
  | RtcOfferMsg
  | RtcAnswerMsg
  | IceCandidateMsg
  | PongMsg;

// ── SignallingClient ──────────────────────────────────────────────────────────

export class SignallingClient {
  private ws: WebSocket | null = null;
  private readonly url: string;
  private token: string | undefined;

  // ── Callbacks set by the caller ───────────────────────────────────────────
  public onMatchFound:    ((payload: MatchFoundPayload) => void) | null = null;
  public onRtcOffer:      ((sdp: RTCSessionDescriptionInit) => void) | null = null;
  public onRtcAnswer:     ((sdp: RTCSessionDescriptionInit) => void) | null = null;
  public onIceCandidate:  ((candidate: RTCIceCandidateInit) => void) | null = null;
  public onConnected:     (() => void) | null = null;
  public onDisconnected:  (() => void) | null = null;

  constructor(url: string, token?: string) {
    this.url   = url;
    this.token = token;
  }

  // ── Connection ────────────────────────────────────────────────────────────

  connect(): void {
    if (this.ws) return;
    this.ws = new WebSocket(this.url);

    this.ws.onopen = () => {
      this.send({
        type: 'connect',
        payload: { token: this.token, region: 'auto' },
      });
      this.onConnected?.();
    };

    this.ws.onmessage = (ev: MessageEvent<string>) => {
      try {
        const msg = JSON.parse(ev.data) as InboundMessage;
        this.handleMessage(msg);
      } catch {
        // ignore malformed messages
      }
    };

    this.ws.onclose  = () => { this.ws = null; this.onDisconnected?.(); };
    this.ws.onerror  = () => { this.ws = null; this.onDisconnected?.(); };
  }

  disconnect(): void {
    this.ws?.close();
    this.ws = null;
  }

  // ── Matchmaking ───────────────────────────────────────────────────────────

  findMatch(mode: 'ranked' | 'casual', characterId: string): void {
    this.send({ type: 'find_match', payload: { mode, characterId } });
  }

  cancelMatch(matchId: string): void {
    this.send({ type: 'match_cancel', payload: { matchId } });
  }

  // ── WebRTC relay ──────────────────────────────────────────────────────────

  sendOffer(matchId: string, sdp: RTCSessionDescriptionInit): void {
    this.send({ type: 'rtc_offer', payload: { matchId, sdp } });
  }

  sendAnswer(matchId: string, sdp: RTCSessionDescriptionInit): void {
    this.send({ type: 'rtc_answer', payload: { matchId, sdp } });
  }

  sendIceCandidate(matchId: string, candidate: RTCIceCandidate): void {
    this.send({ type: 'ice_candidate', payload: { matchId, candidate: candidate.toJSON() } });
  }

  // ── Latency probe ─────────────────────────────────────────────────────────

  ping(): void {
    this.send({ type: 'ping', payload: { timestamp: Date.now() } });
  }

  // ── Private ───────────────────────────────────────────────────────────────

  private send(msg: object): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg));
    }
  }

  private handleMessage(msg: InboundMessage): void {
    switch (msg.type) {
      case 'match_found':    this.onMatchFound?.(msg.payload);    break;
      case 'rtc_offer':      this.onRtcOffer?.(msg.payload.sdp);  break;
      case 'rtc_answer':     this.onRtcAnswer?.(msg.payload.sdp); break;
      case 'ice_candidate':  this.onIceCandidate?.(msg.payload.candidate); break;
      case 'pong':           /* handled externally if needed */    break;
    }
  }
}
