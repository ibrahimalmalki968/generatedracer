import { SIMULATION_STEP } from './constants.js';

const tickMs = SIMULATION_STEP * 1000;
const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));
const angleDelta = (a,b) => Math.atan2(Math.sin(b-a),Math.cos(b-a));

function coordinate(start, end, v0, v1, seconds, t) {
  const delta = end-start;
  if (Math.abs(delta) < .0001) return start;
  // Monotone cubic tangents preserve measured speed on a straight and never
  // overshoot an endpoint as a kart brakes or changes direction.
  const a = Math.max(0,v0*seconds/delta), b = Math.max(0,v1*seconds/delta);
  const limit = Math.min(1,3/(Math.hypot(a,b) || 1));
  return start + delta*(t*t*(3-2*t) + limit*t*(1-t)*(a*(1-t)-b*t));
}

// One monotonic presentation clock for the entire field. Input prediction cannot move it.
export class RacePlayout {
  constructor() {
    this.history = [];
    this.tick = null;
    this.lastFrame = null;
    this.bufferTicks = 5;
    this.steerCue = 0;
  }

  push(snapshot) {
    const last = this.history.at(-1);
    if (last && snapshot.tick <= last.tick) {
      if (last.tick === snapshot.tick) this.history[this.history.length-1] = snapshot;
      return;
    }
    if (last && snapshot.tick-last.tick > 24) {
      // Missing over 400 ms of authority. Resume once at known geometry.
      this.history.length = 0;
      this.tick = null;
    }
    if (last) {
      const gap = (snapshot.received-last.received)/tickMs;
      this.bufferTicks = clamp(Math.max(this.bufferTicks*.985, gap + 1),5,11);
    }
    this.history.push(snapshot);
    if (this.history.length > 24) this.history.shift();
  }

  sample(now, playerId, input) {
    const first = this.history[0], last = this.history.at(-1);
    if (!last) return [];
    const dt = this.lastFrame === null ? 0 : Math.max(0,(now-this.lastFrame)/1000);
    this.lastFrame = Math.max(now,this.lastFrame ?? now);
    const age = Math.max(0, now-last.received)/tickMs;
    const desired = last.tick + age - this.bufferTicks;
    if (this.tick === null || this.tick < first.tick || dt > .5) {
      this.tick = clamp(desired,Math.max(first.tick,this.tick ?? first.tick),last.tick);
      this.steerCue = 0;
    } else {
      const advance = dt/SIMULATION_STEP;
      const rate = clamp(1 + (desired-this.tick-advance)*.035,.85,1.12);
      const headroom = last.tick-this.tick;
      this.tick += Math.min(advance*rate, headroom*.94);
    }
    const index = this.history.findIndex(s => s.tick >= this.tick);
    const a = this.history[Math.max(0,index-1)], b = this.history[index];
    const t = clamp((this.tick-a.tick)/(b.tick-a.tick || 1),0,1);
    return last.cars.map((live,i) => {
      const from = a.cars[i], to = b.cars[i];
      // A missing stretch of road or exceptional authority relocation cannot
      // safely be reconstructed. Hold until the newer confirmed sample.
      const discontinuity = b.tick-a.tick > 24 ||
        Math.hypot(to.x-from.x,to.y-from.y) > 64 + (b.tick-a.tick)*15;
      const f = discontinuity ? Number(t>=1) : t;
      let angle = from.angle + angleDelta(from.angle,to.angle)*f;
      if (live.participantId === playerId) {
        // A small visual turn-in cue answers the thumb before the round trip.
        // A held input already reflected by authority needs no extra cue.
        const cue = live.finished ? 0 : clamp((input?.steer || 0) - (from.rack || 0),-1,1)
          * .10 * Math.min(1,live.speed/100);
        this.steerCue += (cue-this.steerCue)*(1-Math.exp(-18*dt));
        angle += this.steerCue;
      }
      const seconds=(b.tick-a.tick)*SIMULATION_STEP;
      const x=coordinate(from.x,to.x,from.vx,to.vx,seconds,f);
      const y=coordinate(from.y,to.y,from.vy,to.vy,seconds,f);
      return {...live,x,y,angle};
    });
  }
}
