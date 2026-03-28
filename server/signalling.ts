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

// ── ELO ranking constants ─────────────────────────────────────────────────────

const ELO_DEFAULT   = 1200;
const ELO_K_FACTOR  = 32;
const ELO_MAX_DIFF  = 400; // max rating difference for matchmaking

/** Player profile stored server-side. */
interface PlayerProfile {
  id:     string;
  name:   string;
  elo:    number;
  wins:   number;
  losses: number;
}

/** In-memory profile store (persist to DB in production). */
const profiles = new Map<string, PlayerProfile>();

function getOrCreateProfile(clientId: string): PlayerProfile {
  if (!profiles.has(clientId)) {
    profiles.set(clientId, {
      id: clientId,
      name: `Player_${clientId.slice(0, 6)}`,
      elo: ELO_DEFAULT,
      wins: 0,
      losses: 0,
    });
  }
  return profiles.get(clientId)!;
}

function expectedScore(ratingA: number, ratingB: number): number {
  return 1 / (1 + Math.pow(10, (ratingB - ratingA) / 400));
}

function updateElo(
  winnerId: string,
  loserId: string,
): { winnerElo: number; loserElo: number } {
  const winner = getOrCreateProfile(winnerId);
  const loser  = getOrCreateProfile(loserId);

  const eW = expectedScore(winner.elo, loser.elo);
  const eL = expectedScore(loser.elo,  winner.elo);

  winner.elo = Math.round(winner.elo + ELO_K_FACTOR * (1 - eW));
  loser.elo  = Math.round(loser.elo  + ELO_K_FACTOR * (0 - eL));
  winner.wins++;
  loser.losses++;

  return { winnerElo: winner.elo, loserElo: loser.elo };
}

// ── JWT helpers (anonymous guests bypass verification) ────────────────────────

const JWT_SECRET = process.env['JWT_SECRET'] ?? '';

function verifyJwt(token: string): { sub: string } | null {
  // Verify HMAC-SHA256 signature then decode the payload.
  if (!JWT_SECRET || !token) return null;
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const [headerB64, payloadB64, signatureB64] = parts;
    if (!headerB64 || !payloadB64 || !signatureB64) return null;

    // Verify HS256 signature: HMAC-SHA256 over "<header>.<payload>".
    const signingInput = `${headerB64}.${payloadB64}`;
    const expectedSignatureB64 = crypto
      .createHmac('sha256', JWT_SECRET)
      .update(signingInput)
      .digest('base64url');

    const providedSig = Buffer.from(signatureB64, 'base64url');
    const expectedSig = Buffer.from(expectedSignatureB64, 'base64url');
    if (
      providedSig.length !== expectedSig.length ||
      !crypto.timingSafeEqual(providedSig, expectedSig)
    ) {
      return null;
    }

    // Decode and validate header and payload.
    const headerJson = Buffer.from(headerB64, 'base64url').toString('utf8');
    const header = JSON.parse(headerJson) as { alg?: string; [k: string]: unknown };
    if (header.alg !== 'HS256') return null;

    const payloadJson = Buffer.from(payloadB64, 'base64url').toString('utf8');
    const data = JSON.parse(payloadJson) as { sub: string; exp?: number };
    if (!data.sub) return null;
    if (typeof data.exp === 'number' && data.exp < Date.now() / 1000) return null;
    return { sub: data.sub };
  } catch {
    return null;
  }
}

// ── Match room ────────────────────────────────────────────────────────────────

interface MatchRoom {
  matchId:  string;
  hostId:   string;
  guestId:  string;
  seed:     number;
  mode:     'ranked' | 'casual';
}

// ── Connected client ──────────────────────────────────────────────────────────

interface Client {
  id:          string;
  ws:          WebSocket;
  ip:          string;
  characterId: string | null;
  mode:        'ranked' | 'casual' | null;
  matchId:     string | null;
  /** Authenticated profile ID (from JWT sub), or null for anonymous. */
  profileId:   string | null;
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

  // For ranked mode, try to find two ranked players within ELO_MAX_DIFF.
  // For casual, just pair the front two regardless.
  let hostIdx  = 0;
  let guestIdx = -1;

  const host = queue[hostIdx]!;
  if (host.mode === 'ranked' && host.profileId) {
    const hostElo = getOrCreateProfile(host.profileId).elo;
    for (let i = 1; i < queue.length; i++) {
      const candidate = queue[i]!;
      if (candidate.mode !== 'ranked' || !candidate.profileId) continue;
      const candidateElo = getOrCreateProfile(candidate.profileId).elo;
      if (Math.abs(hostElo - candidateElo) <= ELO_MAX_DIFF) {
        guestIdx = i;
        break;
      }
    }
    // Fallback: if no ranked match found, pair with anyone
    if (guestIdx === -1 && queue.length >= 2) guestIdx = 1;
  } else {
    if (queue.length >= 2) guestIdx = 1;
  }

  if (guestIdx === -1) return;

  const guest = queue.splice(guestIdx, 1)[0]!;
  queue.splice(hostIdx, 1);

  const matchId = crypto.randomUUID();
  const seed    = randomSeed();
  const mode    = host.mode ?? 'casual';

  const room: MatchRoom = { matchId, hostId: host.id, guestId: guest.id, seed, mode };
  matches.set(matchId, room);
  host.matchId  = matchId;
  guest.matchId = matchId;

  const hostElo  = host.profileId  ? getOrCreateProfile(host.profileId).elo  : ELO_DEFAULT;
  const guestElo = guest.profileId ? getOrCreateProfile(guest.profileId).elo : ELO_DEFAULT;

  send(host,  { type: 'match_found', payload: {
    matchId, opponentId: guest.id, seed, isHost: true,
    mode, opponentElo: guestElo,
  }});
  send(guest, { type: 'match_found', payload: {
    matchId, opponentId: host.id, seed, isHost: false,
    mode, opponentElo: hostElo,
  }});
}

// ── Message handlers ──────────────────────────────────────────────────────────

interface MatchResultMsg {
  type: 'match_result';
  payload: { matchId: string; winnerId: string };
}

function handleMessage(client: Client, msg: ClientMessage | MatchResultMsg): void {
  switch (msg.type) {
    case 'connect': {
      // Authenticate via JWT if provided; anonymous guests are accepted.
      const token = (msg as ConnectMsg).payload.token;
      if (token) {
        const claim = verifyJwt(token);
        if (claim) {
          client.profileId = claim.sub;
          getOrCreateProfile(claim.sub);
        }
      }
      if (!client.profileId) {
        // Anonymous — create a temporary profile
        client.profileId = client.id;
        getOrCreateProfile(client.id);
      }
      const profile = getOrCreateProfile(client.profileId);
      send(client, { type: 'connected', payload: {
        clientId: client.id,
        elo: profile.elo,
        wins: profile.wins,
        losses: profile.losses,
      }});
      break;
    }

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

    case 'match_result': {
      // Update ELO for ranked matches
      const room = matches.get((msg as MatchResultMsg).payload.matchId);
      if (!room || room.mode !== 'ranked') break;
      const winnerId = (msg as MatchResultMsg).payload.winnerId;
      const loserId  = room.hostId === winnerId ? room.guestId : room.hostId;
      const winnerClient = clients.get(winnerId);
      const loserClient  = clients.get(loserId);
      if (!winnerClient?.profileId || !loserClient?.profileId) break;
      const result = updateElo(winnerClient.profileId, loserClient.profileId);
      send(winnerClient, { type: 'elo_update', payload: { elo: result.winnerElo, delta: result.winnerElo - ELO_DEFAULT } });
      send(loserClient,  { type: 'elo_update', payload: { elo: result.loserElo,  delta: result.loserElo  - ELO_DEFAULT } });
      matches.delete(room.matchId);
      break;
    }
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
    characterId: null, mode: null, matchId: null, profileId: null,
  };
  clients.set(clientId, client);

  ws.on('message', (data: Buffer) => {
    try {
      const msg = JSON.parse(data.toString()) as ClientMessage | MatchResultMsg;
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
