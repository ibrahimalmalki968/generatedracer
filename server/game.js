import { randomBytes, randomUUID } from 'node:crypto';
import { LocalSession } from '../js/simulation.js';
import { SIMULATION_STEP } from '../js/constants.js';
import { controls, displayName, MAX_HUMANS, NEUTRAL, PROTOCOL_VERSION } from '../shared/protocol.js';

const token = () => randomBytes(32).toString('base64url');
const code = () => randomBytes(5).toString('hex').toUpperCase();

/** All mutable racing state is owned by a room, never a browser or a global car array. */
export class Game {
  constructor({ countdownMs = 3000, maxRooms = 32, maxSessions = 256 } = {}) {
    this.rooms = new Map(); this.sessions = new Map();
    this.countdownMs = countdownMs; this.maxRooms = maxRooms; this.maxSessions = maxSessions;
  }

  send(ws, message) {
    if (ws?.readyState === 1) {
      if (ws.bufferedAmount > 262144) { ws.close(1013, 'Connection too slow'); return; }
      ws.send(JSON.stringify(message));
    }
  }

  hello(ws, message) {
    if (message.version !== PROTOCOL_VERSION) throw new Error('Game version changed. Refresh this page.');
    const name = displayName(message.nickname);
    let s = typeof message.token === 'string' ? this.sessions.get(message.token) : null;
    if (s && !s.ws && Date.now() - s.touched > 10 * 60000) { this.sessions.delete(s.token); s = null; }
    if (!s) {
      if (this.sessions.size >= this.maxSessions) throw new Error('Server busy. Try again shortly.');
      s = { token: token(), id: randomUUID(), name, roomId: null, ws: null, touched: Date.now() };
      this.sessions.set(s.token, s);
    }
    if (s.ws && s.ws !== ws) {
      // Only a holder of this secret can replace their own live connection.
      const previous = s.ws; previous.session = null; previous.close(4001, 'Session opened elsewhere');
    }
    s.ws = ws; s.touched = Date.now(); ws.session = s;
    if (!s.roomId) s.name = name;
    this.send(ws, { type: 'welcome', version: PROTOCOL_VERSION, token: s.token, playerId: s.id, nickname: s.name, serverNow: Date.now() });
    if (s.roomId) this.publish(this.rooms.get(s.roomId));
    this.list(ws);
    return s;
  }

  list(ws) {
    this.send(ws, { type: 'rooms', rooms: [...this.rooms.values()].filter(r => !r.private).map(r => ({
      code: r.code, name: r.name, count: r.members.size, capacity: MAX_HUMANS, phase: r.phase,
      available: r.phase === 'lobby' && r.members.size < MAX_HUMANS,
    })) });
  }

  publicLists() { for (const s of this.sessions.values()) if (s.ws && !s.roomId) this.list(s.ws); }

  create(s, message) {
    if (s.roomId) throw new Error('Leave your current room first.');
    if (this.rooms.size >= this.maxRooms) throw new Error('All rooms are in use. Join a public room or try later.');
    if (typeof message.private !== 'boolean') throw new Error('Choose public or private.');
    let roomCode; do { roomCode = code(); } while (this.rooms.has(roomCode));
    const r = { code: roomCode, name: displayName(message.name || `${s.name}'s race`, 32), private: message.private,
      members: new Map(), phase: 'lobby', revision: 0, raceId: null, engine: null, tick: 0, results: null, startAt: null };
    this.rooms.set(r.code, r); this.join(s, r.code);
  }

  join(s, rawCode) {
    if (s.roomId) throw new Error('Leave your current room first.');
    if (typeof rawCode !== 'string' || !/^[A-Fa-f0-9]{10}$/.test(rawCode.trim())) throw new Error('Invalid room code.');
    const r = this.rooms.get(rawCode.trim().toUpperCase());
    if (!r) throw new Error('Room not found or expired.');
    if (r.phase !== 'lobby') throw new Error('Race in Progress. Join when this room returns to the lobby.');
    if (r.members.size >= MAX_HUMANS) throw new Error('Room is full.');
    s.roomId = r.code;
    r.members.set(s.id, { session: s, ready: false, seq: 0, boost: 0, input: NEUTRAL, receivedAt: 0, pendingBoost: null, carId: null });
    this.rosterChanged(r); this.publicLists();
  }

  rosterChanged(r) {
    r.revision++; r.phase = 'lobby'; r.startAt = null;
    for (const m of r.members.values()) m.ready = false;
    this.publish(r);
  }

  ready(s, value) {
    const r = this.room(s);
    if (!['lobby', 'countdown'].includes(r.phase) || r.members.size < 2 || typeof value !== 'boolean') throw new Error('Ready is only available before multiplayer races.');
    if (r.members.get(s.id).ready === value) return;
    if (r.phase === 'countdown') { r.phase = 'lobby'; r.startAt = null; }
    r.members.get(s.id).ready = value; r.revision++;
    if ([...r.members.values()].every(m => m.ready)) this.countdown(r);
    else this.publish(r);
    this.publicLists();
  }

  start(s) {
    const r = this.room(s);
    if (r.phase !== 'lobby' || r.members.size !== 1) throw new Error('Solo Start requires exactly one player in the lobby.');
    this.countdown(r);
  }

  countdown(r) {
    r.phase = 'countdown'; r.startAt = Date.now() + this.countdownMs; r.startRevision = r.revision;
    r.raceId = randomUUID(); r.results = null; r.engine = null;
    this.publish(r); this.publicLists();
  }

  cancel(s) {
    const r = this.room(s);
    if (r.phase !== 'countdown') throw new Error('There is no countdown to cancel.');
    this.rosterChanged(r); this.publicLists();
  }

  begin(r) {
    if (r.phase !== 'countdown' || r.revision !== r.startRevision || !r.members.size ||
        (r.members.size > 1 && ![...r.members.values()].every(m => m.ready))) return;
    r.engine = new LocalSession(r.members.size); r.tick = 0;
    [...r.members.values()].forEach((m, i) => {
      m.carId = i; m.seq = 0; m.appliedSeq = 0; m.boost = 0; m.pendingBoost = null; m.input = NEUTRAL; m.receivedAt = 0;
      r.engine.cars[i].name = m.session.name; r.engine.cars[i].participantId = m.session.id;
    });
    r.engine.start(); r.phase = 'racing';
    this.publish(r); this.publicLists();
  }

  input(s, message) {
    const r = this.room(s);
    if (r.phase !== 'racing' || message.raceId !== r.raceId) return; // stale packets never mutate another race
    const input = controls(message), m = r.members.get(s.id);
    if (message.seq <= m.seq || message.boost < m.boost) return;
    m.seq = message.seq; m.input = input; m.receivedAt = performance.now();
    if (message.boost > m.boost) m.pendingBoost = r.engine.cars[m.carId].lap;
    m.boost = message.boost;
  }

  room(s) {
    const r = this.rooms.get(s.roomId);
    if (!r || !r.members.has(s.id)) throw new Error('Join a room first.');
    return r;
  }

  leave(s) {
    const r = this.rooms.get(s.roomId); s.roomId = null;
    if (!r) return;
    const m = r.members.get(s.id); r.members.delete(s.id);
    if (r.phase === 'racing' && m?.carId !== null) {
      r.engine.race.disconnect(m.carId);
      if (r.engine.race.finished) this.finalize(r);
    }
    if (!r.members.size) this.rooms.delete(r.code);
    else if (r.phase === 'lobby' || r.phase === 'countdown') this.rosterChanged(r);
    else this.publish(r);
    this.send(s.ws, { type: 'left' }); this.publicLists();
  }

  disconnect(ws) {
    const s = ws.session;
    if (!s || s.ws !== ws) return;
    s.ws = null; s.touched = Date.now(); this.leave(s);
  }

  finalize(r) {
    if (r.phase !== 'racing') return;
    r.phase = 'results';
    r.results = Object.freeze(r.engine.race.getResults().map(result => Object.freeze({ ...result,
      position: result.status === 'disconnected' ? null : result.position,
    })));
    this.publish(r); this.publicLists();
  }

  back(s, raceId) {
    const r = this.room(s);
    if (r.phase !== 'results' || r.raceId !== raceId) throw new Error('Results have already changed.');
    r.engine = null; r.raceId = null; r.results = null; r.tick = 0;
    for (const m of r.members.values()) {
      m.carId = null; m.seq = 0; m.appliedSeq = 0; m.boost = 0; m.input = NEUTRAL; m.pendingBoost = null; m.receivedAt = 0;
    }
    this.rosterChanged(r); this.publicLists();
  }

  step() {
    const now = performance.now();
    for (const r of this.rooms.values()) {
      if (r.phase === 'countdown' && Date.now() >= r.startAt) this.begin(r);
      if (r.phase !== 'racing') continue;
      const inputs = [];
      for (const m of r.members.values()) {
        const c = r.engine.cars[m.carId];
        const boost = m.pendingBoost === c.lap;
        inputs[m.carId] = now - m.receivedAt < 750 ? { ...m.input, turbo: boost } : NEUTRAL;
        m.appliedSeq = m.seq; m.pendingBoost = null;
      }
      r.engine.step(SIMULATION_STEP, inputs); r.tick++;
      if (r.engine.race.finished) this.finalize(r);
    }
  }

  snapshot(r) {
    const memberById = new Map([...r.members.values()].map(m => [m.carId, m]));
    return { type: 'snapshot', roomCode: r.code, raceId: r.raceId, tick: r.tick, serverNow: Date.now(),
      elapsed: r.engine.race.elapsed, winnerId: r.engine.race.winnerId,
      cars: r.engine.cars.map(c => ({ id: c.id, name: c.name, participantId: c.participantId || null, isHuman: c.isHuman,
        x: c.x, y: c.y, angle: c.angle, speed: c.speed, lap: c.lap, position: c.position,
        turboActive: c.turboActive, turboAvailable: c.turboAvailable, turboTimer: c.turboTimer, turboUses: c.turboUses,
        finished: c.finished, disconnected: c.disconnected, bestLap: r.engine.race.getBestLap(c.id), finishTime: r.engine.race.getFinishTime(c.id),
        ack: memberById.get(c.id)?.appliedSeq || 0,
      })) };
  }

  publish(r) {
    if (!r) return;
    const room = { code: r.code, name: r.name, private: r.private, capacity: MAX_HUMANS, phase: r.phase,
      revision: r.revision, raceId: r.raceId, startAt: r.startAt, serverNow: Date.now(), results: r.results,
      players: [...r.members.values()].map(m => ({ id: m.session.id, nickname: m.session.name, ready: m.ready, carId: m.carId })) };
    for (const m of r.members.values()) {
      this.send(m.session.ws, { type: 'room', room });
      if (r.engine) this.send(m.session.ws, this.snapshot(r));
    }
  }

  broadcastSnapshots() {
    for (const r of this.rooms.values()) if (r.phase === 'racing') {
      const snapshot = this.snapshot(r);
      for (const m of r.members.values()) this.send(m.session.ws, snapshot);
    }
  }

  sweep() {
    for (const [key, s] of this.sessions) if (!s.ws && Date.now() - s.touched > 10 * 60000) this.sessions.delete(key);
  }
}
