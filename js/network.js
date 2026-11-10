import { message as notice, MessageError, isTranslationKey } from '../shared/translations.js';
/** Authoritative WebSocket client with local prediction/reconciliation and remote interpolation. */
import { Car } from './car.js';
import { SIMULATION_STEP } from './constants.js';
import { PROTOCOL_VERSION } from '../shared/protocol.js';

export class Network extends EventTarget {
  constructor() {
    super();
    this.socket = null; this.playerId = null; this.room = null; this.latest = null;
    this.previous = null; this.predicted = null; this.pending = []; this.seq = 0; this.boost = 0;
    this.boostHeld = false; this.offset = 0; this.requests = new Map(); this.requestId = 0;
    this.reconnectTimer = null; this.retry = 0; this.stopped = false; this.ready = false;
    try { this.token = sessionStorage.getItem('racer-session'); } catch { this.token = null; }
  }
  emit(type, detail) { this.dispatchEvent(new CustomEvent(type, { detail })); }
  connect(nickname) {
    this.nickname = nickname; this.stopped = false;
    if (this.socket && this.socket.readyState < 2) return;
    const scheme = location.protocol === 'https:' ? 'wss:' : 'ws:';
    const socket = new WebSocket(`${scheme}//${location.host}/socket`); this.socket = socket;
    this.emit('status', notice('connection.connecting'));
    socket.onopen = () => this.send({ type: 'hello', version: PROTOCOL_VERSION, nickname, token: this.token });
    socket.onerror = () => this.emit('status', notice('connection.retry'));
    socket.onmessage = e => {
      if (this.socket !== socket) return;
      let message; try { message = JSON.parse(e.data); } catch { return; }
      if (message.serverNow) this.offset = message.serverNow - Date.now();
      if (message.type === 'welcome') {
        this.playerId = message.playerId; this.token = message.token; this.ready = true; this.retry = 0;
        try { sessionStorage.setItem('racer-session', this.token); } catch { /* session stays memory-only */ }
        this.emit('status', notice('connection.connected')); this.emit('welcome', message);
      } else if (message.type === 'room') {
        const oldRace = this.room?.raceId;
        this.room = message.room; this.offset = message.room.serverNow - Date.now();
        if (oldRace !== this.room.raceId) this.resetRace();
        this.emit('room', this.room);
      } else if (message.type === 'snapshot') this.apply(message);
      else if (message.type === 'left') {
        this.room = null; this.resetRace(); this.emit('left', message);
      } else if (message.type === 'rooms') this.emit('rooms', message.rooms);
      else if (message.type === 'ack' || message.type === 'error') {
        const waiter = this.requests.get(message.requestId);
        if (waiter) {
          clearTimeout(waiter.timer); this.requests.delete(message.requestId);
          if (message.type === 'error') waiter.reject(new MessageError(message.code || 'error.unknown', message.params)); else waiter.resolve();
        } else if (message.type === 'error') this.emit('error', { key: message.code || 'error.unknown', params: message.params });
      }
    };
    socket.onclose = e => {
      if (this.socket !== socket) return;
      this.ready = false;
      this.closeMessage = notice(isTranslationKey(e.reason) ? e.reason : e.code === 4001 ? 'connection.elsewhere' : 'connection.disconnected');
      for (const w of this.requests.values()) { clearTimeout(w.timer); w.reject(new MessageError('error.connectionLost')); }
      this.requests.clear(); this.room = null; this.resetRace(); this.emit('disconnected', e.code);
      if (e.code === 4001) { this.stopped = true; this.emit('status', notice('error.sessionElsewhere')); }
      else if (!this.stopped) {
        this.emit('status', notice('connection.reconnecting'));
        this.reconnectTimer = setTimeout(() => this.connect(this.nickname), Math.min(5000, 500 * 2 ** this.retry++));
      }
    };
  }
  send(m) {
    if (this.socket?.readyState !== WebSocket.OPEN) return false;
    if (this.socket.bufferedAmount > 32768 && m.type === 'input') return false;
    this.socket.send(JSON.stringify(m)); return true;
  }
  command(type, body = {}) {
    return new Promise((resolve, reject) => {
      if (!this.ready) { reject(new MessageError('error.notConnected')); return; }
      const requestId = String(++this.requestId);
      const timer = setTimeout(() => { this.requests.delete(requestId); reject(new MessageError('error.timeout')); }, 8000);
      this.requests.set(requestId, { resolve, reject, timer });
      this.send({ type, ...body, requestId,
        ...(['ready', 'start', 'cancel'].includes(type) ? { lobbyId: this.room?.lobbyId } : {}),
        ...(type === 'leave' ? { roomCode: this.room?.code } : {}),
      });
    });
  }
  resetRace() {
    this.latest = null; this.previous = null; this.predicted = null; this.pending = [];
    this.seq = 0; this.boost = 0; this.boostHeld = false;
  }
  apply(snapshot) {
    if (!this.room || snapshot.roomCode !== this.room.code || snapshot.raceId !== this.room.raceId ||
        (this.latest && snapshot.tick < this.latest.tick)) return;
    this.previous = this.latest; this.latest = { ...snapshot, received: performance.now() };
    const own = snapshot.cars.find(c => c.participantId === this.playerId);
    if (own) {
      if (!this.predicted || this.predicted.id !== own.id) this.predicted = new Car(own.id, own.x, own.y, own.angle);
      Object.assign(this.predicted, own); this.predicted._turboHeld = false;
      this.pending = this.pending.filter(p => p.seq > own.ack).slice(-120);
      for (const p of this.pending) { this.predicted.input = p.input; this.predicted.update(SIMULATION_STEP); }
    }
    this.emit('snapshot', this.latest);
  }
  predict(input) {
    if (!this.ready || this.room?.phase !== 'racing' || !this.predicted || this.predicted.finished || this.predicted.disconnected) return;
    const pulse = input.turbo && !this.boostHeld;
    this.boostHeld = input.turbo;
    if (pulse) this.boost++;
    const seq = ++this.seq;
    const local = { ...input, turbo: Boolean(pulse) };
    if (this.send({ type: 'input', raceId: this.room.raceId, seq, boost: this.boost,
      steer: input.steer, gas: input.gas, brake: input.brake })) {
      this.pending.push({ seq, input: local }); this.pending = this.pending.slice(-120);
      this.predicted.input = local; this.predicted.update(SIMULATION_STEP);
    }
  }
  displayCars() {
    if (!this.latest) return [];
    const age = performance.now() - this.latest.received;
    const alpha = Math.max(0, Math.min(1, age / 50));
    return this.latest.cars.map(car => {
      if (car.participantId === this.playerId && this.predicted) return { ...car, x: this.predicted.x, y: this.predicted.y,
        angle: this.predicted.angle, speed: this.predicted.speed }; // status remains authoritative
      const before = this.previous?.cars.find(c => c.id === car.id);
      if (!before) return car;
      const turn = Math.atan2(Math.sin(car.angle - before.angle), Math.cos(car.angle - before.angle));
      return { ...car, x: before.x + (car.x - before.x) * alpha, y: before.y + (car.y - before.y) * alpha,
        angle: before.angle + turn * alpha };
    });
  }
  neutral() {
    if (this.room?.phase === 'racing') this.predict({ steer: 0, gas: 0, brake: 0, turbo: false });
  }
  destroy() { this.stopped = true; clearTimeout(this.reconnectTimer); this.socket?.close(); }
}
