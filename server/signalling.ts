// server/signalling.ts
// WebSocket signalling server for Aether Clash.
//
// Responsibilities:
//   - Accept connections from browser clients (anonymous or JWT).
//   - Handle matchmaking: pair two players for a casual or ranked match.
//   - Relay WebRTC offer/answer/ICE-candidate messages between peers.
//   - Send `match_found` with a shared random `seed` so both peers start with
//     identical PRNG state for item spawns and Guardian selection.
//   - Rate-limit: max 10 connection requests per IP per minute.
//
// Run with:   node --loader ts-node/esm server/signalling.ts
//         or: npx ts-node server/signalling.ts

import { WebSocketServer, WebSocket } from 'ws';
import type { IncomingMessage } from 'http';
import * as http from 'http';
import * as crypto from 'crypto';

// ── Configuration ─────────────────────────────────────────────────────────────

const PORT = parseInt(process.env['PORT'] ?? '8080', 10);

/** Maximum connection requests allowed per IP per minute. */
const RATE_LIMIT_MAX    = 10;
const RATE_LIMIT_WINDOW = 60_000; // ms

// ── Rate limiter ──────────────────────────────────────────────────────────────

/** timestamps of recent connection attempts per IP */
const rateLimitMap = new Map<string, number[]>();

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const attempts = (rateLimitMap.get(ip) ?? []).filter(t => now - t < RATE_LIMIT_WINDOW);
  attempts.push(now);
  rateLimitMap.set(ip, attempts);
  return attempts.length > RATE_LIMIT_MAX;
}

// ── Message types ─────────────────────────────────────────────────────────────

interface ConnectMsg {
  type: 'connect';
  payload: { token?: string; region?: string };
}

interface FindMatchMsg {
  type: 'find_match';
  payload: { mode: 'ranked' | 'casual'; characterId: string };
}

interface RtcOfferMsg {
  type: 'rtc_offer';
  payload: { matchId: string; sdp: object };
}

interface RtcAnswerMsg {
  type: 'rtc_answer';
  payload: { matchId: string; sdp: object };
}

interface IceCandidateMsg {
  type: 'ice_candidate';
  payload: { matchId: string; candidate: object };
}

interface MatchCancelMsg {
  type: 'match_cancel';
  payload: { matchId: string };
}

interface PingMsg {
  type: 'ping';
  payload: { timestamp: number };
}

type ClientMessage =
  | ConnectMsg
  | FindMatchMsg
  | RtcOfferMsg
  | RtcAnswerMsg
  | IceCandidateMsg
  | MatchCancelMsg
  | PingMsg;

// ── Match room ────────────────────────────────────────────────────────────────

interface MatchRoom {
  matchId:  string;
  hostId:   string;
  guestId:  string;
  seed:     number;
}

// ── Connected client ──────────────────────────────────────────────────────────

interface Client {
  id:          string;
  ws:          WebSocket;
  ip:          string;
  characterId: string | null;
  mode:        'ranked' | 'casual' | null;
  matchId:     string | null;
}

// ── Server state ──────────────────────────────────────────────────────────────

const clients  = new Map<string, Client>();
const queue:    Client[] = [];
const matches  = new Map<string, MatchRoom>();

// ── Helpers ───────────────────────────────────────────────────────────────────

function send(client: Client, msg: object): void {
  if (client.ws.readyState === WebSocket.OPEN) {
    client.ws.send(JSON.stringify(msg));
  }
}

function randomSeed(): number {
  return (crypto.randomInt(0, 0x7FFFFFFF)) >>> 0;
}

function getClientIp(req: IncomingMessage): string {
  const fwd = req.headers['x-forwarded-for'];
  if (typeof fwd === 'string') return fwd.split(',')[0]?.trim() ?? '0.0.0.0';
  return req.socket.remoteAddress ?? '0.0.0.0';
}

// ── Match-making ──────────────────────────────────────────────────────────────

function tryPairMatch(): void {
  if (queue.length < 2) return;

  const host  = queue.shift()!;
  const guest = queue.shift()!;
  const matchId = crypto.randomUUID();
  const seed    = randomSeed();

  const room: MatchRoom = { matchId, hostId: host.id, guestId: guest.id, seed };
  matches.set(matchId, room);
  host.matchId  = matchId;
  guest.matchId = matchId;

  send(host,  { type: 'match_found', payload: { matchId, opponentId: guest.id, seed, isHost: true  } });
  send(guest, { type: 'match_found', payload: { matchId, opponentId: host.id,  seed, isHost: false } });
}

// ── Message handlers ──────────────────────────────────────────────────────────

function handleMessage(client: Client, msg: ClientMessage): void {
  switch (msg.type) {
    case 'connect':
      // Authentication: JWT validation would happen here for ranked mode.
      // For now, anonymous connections are accepted unconditionally.
      send(client, { type: 'connected', payload: { clientId: client.id } });
      break;

    case 'find_match': {
      client.characterId = msg.payload.characterId;
      client.mode        = msg.payload.mode;
      if (!queue.includes(client)) queue.push(client);
      tryPairMatch();
      break;
    }

    case 'rtc_offer': {
      const room = matches.get(msg.payload.matchId);
      if (!room) break;
      const peerId = room.hostId === client.id ? room.guestId : room.hostId;
      const peer   = clients.get(peerId);
      if (peer) send(peer, { type: 'rtc_offer', payload: msg.payload });
      break;
    }

    case 'rtc_answer': {
      const room = matches.get(msg.payload.matchId);
      if (!room) break;
      const peerId = room.hostId === client.id ? room.guestId : room.hostId;
      const peer   = clients.get(peerId);
      if (peer) send(peer, { type: 'rtc_answer', payload: msg.payload });
      break;
    }

    case 'ice_candidate': {
      const room = matches.get(msg.payload.matchId);
      if (!room) break;
      const peerId = room.hostId === client.id ? room.guestId : room.hostId;
      const peer   = clients.get(peerId);
      if (peer) send(peer, { type: 'ice_candidate', payload: msg.payload });
      break;
    }

    case 'match_cancel': {
      const idx = queue.indexOf(client);
      if (idx !== -1) queue.splice(idx, 1);
      if (msg.payload.matchId) matches.delete(msg.payload.matchId);
      break;
    }

    case 'ping':
      send(client, { type: 'pong', payload: { timestamp: msg.payload.timestamp } });
      break;
  }
}

// ── Server setup ──────────────────────────────────────────────────────────────

const server = http.createServer((_req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('Aether Clash Signalling Server');
});

const wss = new WebSocketServer({ server });

wss.on('connection', (ws: WebSocket, req: IncomingMessage) => {
  const ip = getClientIp(req);

  if (isRateLimited(ip)) {
    ws.close(1008, 'Rate limit exceeded');
    return;
  }

  const clientId = crypto.randomUUID();
  const client: Client = {
    id: clientId, ws, ip,
    characterId: null, mode: null, matchId: null,
  };
  clients.set(clientId, client);

  ws.on('message', (data: Buffer) => {
    try {
      const msg = JSON.parse(data.toString()) as ClientMessage;
      handleMessage(client, msg);
    } catch {
      // ignore malformed messages
    }
  });

  ws.on('close', () => {
    clients.delete(clientId);
    const idx = queue.indexOf(client);
    if (idx !== -1) queue.splice(idx, 1);
    if (client.matchId) matches.delete(client.matchId);
  });

  ws.on('error', () => {
    ws.close();
  });
});

server.listen(PORT, () => {
  console.log(`[signalling] Aether Clash signalling server listening on port ${PORT}`);
});

export { wss, server };
