/** Ordered directional gates and a simulation clock. No race expiration. */
import { CHECKPOINT_INDICES, NUM_CHECKPOINTS, SPLINE_POINTS, trackProgress } from './track.js';
import { NUM_LAPS, ORDINALS, TRACK_WIDTH, CAR_WIDTH, MAX_SPEED, TURBO_SPEED_MULT, CAR_LENGTH } from './constants.js';

export const GATES = CHECKPOINT_INDICES.map(idx => {
  const p = SPLINE_POINTS[idx];
  const before = SPLINE_POINTS[(idx - 1 + SPLINE_POINTS.length) % SPLINE_POINTS.length];
  const after = SPLINE_POINTS[(idx + 1) % SPLINE_POINTS.length];
  const length = Math.hypot(after.x - before.x, after.y - before.y);
  return { ...p, tx: (after.x - before.x) / length, ty: (after.y - before.y) / length };
});

export function crossingFraction(from, to, gate) {
  const a = (from.x - gate.x) * gate.tx + (from.y - gate.y) * gate.ty;
  const b = (to.x - gate.x) * gate.tx + (to.y - gate.y) * gate.ty;
  if (a >= 0 || b < 0) return null;
  const fraction = -a / (b - a);
  const x = from.x + (to.x - from.x) * fraction - gate.x;
  const y = from.y + (to.y - from.y) * fraction - gate.y;
  return Math.abs(-x * gate.ty + y * gate.tx) <= (TRACK_WIDTH + CAR_WIDTH) / 2 ? fraction : null;
}

export class RaceManager {
  constructor(cars) {
    this.cars = cars;
    this.startTime = null;
    this.elapsed = 0;
    this.finished = false;
    this.winnerId = null;
    this._finishCounter = 0;
    this._state = cars.map(c => ({ lap: 0, nextCheckpoint: 1, previous: { x: c.x, y: c.y },
      progress: 0, lapStartTime: 0, bestLapTime: null, finishTime: null, finishSeq: null, disconnected: false }));
  }

  start() {
    if (this.startTime !== null) return;
    this.startTime = 0;
    this.cars.forEach((c, i) => { this._state[i].previous = { x: c.x, y: c.y }; });
  }

  update(dt) {
    if (this.startTime === null || this.finished || !Number.isFinite(dt) || dt <= 0) return;
    const before = this.elapsed;
    this.elapsed += dt * 1000;
    const finishers = [];
    this.cars.forEach((car, i) => {
      const s = this._state[i];
      if (s.finishTime !== null || s.disconnected) return;
      const distance = Math.hypot(car.x - s.previous.x, car.y - s.previous.y);
      const maxStep = MAX_SPEED * TURBO_SPEED_MULT * dt + CAR_LENGTH * 2; // allow collision separation
      const f = distance <= maxStep ? crossingFraction(s.previous, car, GATES[s.nextCheckpoint]) : null;
      if (f !== null) {
        if (s.nextCheckpoint === 0) {
          const crossedAt = before + dt * 1000 * f;
          const lapTime = crossedAt - s.lapStartTime;
          s.bestLapTime = s.bestLapTime === null ? lapTime : Math.min(s.bestLapTime, lapTime);
          s.lap++;
          s.lapStartTime = crossedAt;
          s.nextCheckpoint = 1;
          if (s.lap === NUM_LAPS) {
            s.finishTime = crossedAt;
            car.finished = true;
            car.speed = 0;
            finishers.push({ car, s });
          }
          car.beginLap(s.lap);
        } else {
          s.nextCheckpoint = (s.nextCheckpoint + 1) % NUM_CHECKPOINTS;
        }
      }
      s.previous = { x: car.x, y: car.y };
      // Ranking is checkpoint-bounded, so skipping a gate cannot improve a full sector.
      const sector = s.nextCheckpoint === 0 ? NUM_CHECKPOINTS - 1 : s.nextCheckpoint - 1;
      s.progress = Math.max(sector / NUM_CHECKPOINTS,
        Math.min((sector + 1) / NUM_CHECKPOINTS - 0.00001, trackProgress(car.x, car.y)));
      car.lap = s.lap;
    });
    finishers.sort((a, b) => a.s.finishTime - b.s.finishTime || a.car.id - b.car.id).forEach(({ car, s }) => {
      s.finishSeq = ++this._finishCounter;
      if (this.winnerId === null) this.winnerId = car.id;
    });
    this._rank();
    this._checkComplete();
  }

  disconnect(carId) {
    const i = this.cars.findIndex(c => c.id === carId);
    if (i < 0) return;
    this.cars[i].disconnected = true;
    this.cars[i].speed = 0;
    this._state[i].disconnected = true;
    this._rank();
    this._checkComplete();
  }

  _checkComplete() {
    // AI may win, but a connected human must always be allowed to finish.
    const humans = this.cars.filter(c => c.isHuman);
    this.finished = humans.length > 0 && humans.every(c => c.finished || c.disconnected);
  }

  _rank() {
    this.cars.map((car, i) => ({ car, s: this._state[i] })).sort((a, b) => {
      if (a.s.finishSeq !== null || b.s.finishSeq !== null) return (a.s.finishSeq ?? Infinity) - (b.s.finishSeq ?? Infinity);
      if (a.s.disconnected !== b.s.disconnected) return a.s.disconnected ? 1 : -1;
      return (b.s.lap + b.s.progress) - (a.s.lap + a.s.progress) || a.car.id - b.car.id;
    }).forEach(({ car }, i) => { car.position = i + 1; });
  }

  getLap(i) { return this._state[i]?.lap ?? 0; }
  getOrdinal(i) { return ORDINALS[this.cars[i].position - 1]; }
  getBestLap(i) { return this._state[i]?.bestLapTime ?? null; }
  getFinishTime(i) { return this._state[i]?.finishTime ?? null; }
  getResults() {
    return this.cars.map((c, i) => ({ id: c.id, name: c.name, nameKey: c.nameKey, nameParams: c.nameParams, isHuman: c.isHuman, position: c.position,
      lap: this._state[i].lap, bestLap: this._state[i].bestLapTime, finishTime: this._state[i].finishTime,
      status: c.finished ? 'finished' : c.disconnected ? 'disconnected' : 'unfinished', finished: c.finished,
    })).sort((a, b) => a.position - b.position);
  }
}

export function formatTime(ms) {
  if (ms === null || ms === undefined) return '--:--.---';
  const value = Math.max(0, Math.floor(ms));
  return `${Math.floor(value / 60000)}:${String(Math.floor(value / 1000) % 60).padStart(2, '0')}.${String(value % 1000).padStart(3, '0')}`;
}
