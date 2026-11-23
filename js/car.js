/**
 * car.js – Car class with arcade physics.
 *
 * Coordinate system  (canvas-default):
 *   x → right,  y ↓ down,  angle 0 = facing right, π/2 = facing down.
 *
 * The car is represented as a rectangle of CAR_LENGTH × CAR_WIDTH,
 * rendered rotated by `angle` around the car centre.
 */

import {
  CAR_LENGTH, CAR_WIDTH, NUM_LAPS,
  MAX_SPEED, ACCELERATION, BRAKING, TURN_RATE, TRACK_WIDTH,
  CAR_COLORS,
  TURBO_DURATION, TURBO_SPEED_MULT,
  TURBO_FLAME_BASE, TURBO_FLAME_RAND,
} from './constants.js';
import { roadFrame } from './track.js';

export class Car {
  /**
   * @param {number} id        – race-local slot; ownership is explicit in isHuman
   * @param {number} x         – initial world x
   * @param {number} y         – initial world y
   * @param {number} angle     – initial heading (radians)
   */
  constructor(id, x, y, angle = 0, { isHuman = true, name = 'YOU' } = {}) {
    this.id    = id;
    this.isHuman = isHuman;
    this.name = name;
    this.disconnected = false;
    this.color = CAR_COLORS[id % CAR_COLORS.length];

    // World-space state
    this.x     = x;
    this.y     = y;
    this.angle = angle;
    this.speed = 0;
    this.vx = 0;
    this.vy = 0;
    this.rack = 0;
    this.tick = 0;
    this.impactTick = -1000;
    this.impact = 0;

    // Input snapshot (filled each frame by player-input or AI)
    this.input = { gas: 0, brake: 0, steer: 0, turbo: false };

    // Turbo boost
    this.turboActive   = false;
    this.turboTimer    = 0;
    this.turboAvailable = true;
    this.turboUses = 0;
    this._turboHeld = false;

    // Race state (managed by race.js)
    this.lap               = 0;
    this.checkpointsPassed = new Set();
    this.finished          = false;
    this.finishTime        = null;
    this.position          = id + 1;
    this.bestLapTime       = null;
    this.lapStartTime      = null;
  }

  /** Advance physics by `dt` seconds. */
  update(dt) {
    if (this.finished || this.disconnected) { this.speed = 0; return; }
    this.tick++;

    // ---- Turbo ---------------------------------------------------------------
    if (this.input.turbo && !this._turboHeld && this.turboAvailable) {
      this.turboActive   = true;
      this.turboTimer    = TURBO_DURATION;
      this.turboAvailable = false;
      this.turboUses++;
    }
    this._turboHeld = Boolean(this.input.turbo);
    if (this.turboActive) {
      this.turboTimer = Math.max(0, this.turboTimer - dt);
      if (this.turboTimer <= 0) this.turboActive = false;
    }

    const brake = this.input.brake;
    const cap = MAX_SPEED * (this.turboActive ? TURBO_SPEED_MULT : 1);
    const drive = ACCELERATION * (this.turboActive ? 1.85 : 1) * (1 - .64 * Math.min(1, this.speed / cap));
    if (brake > 0) this.speed = Math.max(0, this.speed - BRAKING * brake * dt);
    else if (this.speed > cap) this.speed = Math.max(cap, this.speed - 290 * dt);
    else this.speed = Math.min(cap, this.speed + drive * dt);

    const demand = this.input.steer;
    const unwinding = demand * this.rack < 0 || Math.abs(demand) < Math.abs(this.rack);
    const rate = unwinding ? 8.5 : 3.6;
    const delta = Math.max(-rate * dt, Math.min(rate * dt, demand - this.rack));
    this.rack += delta;
    const fraction = Math.min(1.4, this.speed / MAX_SPEED);
    const yaw = TURN_RATE * Math.min(1, this.speed / 118) / (1 + .70 * fraction);
    const wheel = this.rack * (.70 + .30 * Math.abs(this.rack));
    this.angle += wheel * yaw * dt;

    const grip = 19 - 2.5 * Math.min(1, fraction) * Math.abs(this.rack);
    const blend = 1 - Math.exp(-grip * dt);
    const previousSpeed = Math.hypot(this.vx, this.vy);
    const carried = Math.min(this.speed,previousSpeed);
    const retained = previousSpeed > 0 ? carried / previousSpeed * (1-blend) : 0;
    const driveSpeed = this.speed - carried + carried*blend;
    this.vx = this.vx * retained + Math.cos(this.angle) * driveSpeed;
    this.vy = this.vy * retained + Math.sin(this.angle) * driveSpeed;
    this.speed = Math.hypot(this.vx, this.vy);
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    containCar(this, dt);
  }

  /** Discard the previous lap's boost; holding the button cannot spend the new one. */
  beginLap(lap) {
    this.lap = lap;
    this.turboActive = false;
    this.turboTimer = 0;
    this.turboAvailable = !this.finished && lap < NUM_LAPS;
  }

  /** Draw the car onto `ctx` (world-space context).
   * @param {CanvasRenderingContext2D} ctx
   */
  draw(ctx, contact = false) {
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.angle);

    const hl = CAR_LENGTH / 2;
    const hw = CAR_WIDTH  / 2;

    // Turbo flame (drawn before car body so it appears behind)
    if (this.turboActive) {
      const flameLen = TURBO_FLAME_BASE + Math.random() * TURBO_FLAME_RAND;
      const grad = ctx.createLinearGradient(-hl, 0, -hl - flameLen, 0);
      grad.addColorStop(0,   'rgba(255,200,0,0.95)');
      grad.addColorStop(0.4, 'rgba(255,80,0,0.7)');
      grad.addColorStop(1,   'rgba(255,0,0,0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.ellipse(-hl - flameLen / 2, 0, flameLen / 2, hw * 0.65, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fillRect(-hl + 3, -hw + 3, CAR_LENGTH, CAR_WIDTH);

    // Four tire silhouettes and a lower chassis give the kart height in the tilted view.
    ctx.fillStyle = '#19252b';
    for (const axle of [-hl*.64,hl*.53]) {
      ctx.fillRect(axle-4,-hw-2,9,6); ctx.fillRect(axle-4,hw-4,9,6);
    }
    ctx.fillStyle = '#27353b';
    ctx.fillRect(-hl-1,-hw+1, CAR_LENGTH, CAR_WIDTH);
    // Body
    ctx.fillStyle = this.color;
    ctx.beginPath();
    if (ctx.roundRect) {
      ctx.roundRect(-hl, -hw, CAR_LENGTH, CAR_WIDTH, 5);
    } else {
      ctx.rect(-hl, -hw, CAR_LENGTH, CAR_WIDTH);
    }
    ctx.fill();

    // Windshield (front third)
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(hl * 0.05, -hw * 0.5, hl * 0.5, hw);

    ctx.fillStyle = '#b1d4e4';
    ctx.fillRect(hl*.27,-hw*.48,3,hw*.96);
    ctx.fillStyle = '#172528';
    ctx.fillRect(-hl*.85,-hw*.79,5,hw*1.58);
    ctx.fillStyle = '#ffffff99';
    ctx.fillRect(-hl*.48,-hw*.76,hl*.78,2);
    // Headlights
    ctx.fillStyle = '#fff';
    ctx.fillRect(hl - 6, -hw * 0.65, 5, 4);
    ctx.fillRect(hl - 6,  hw * 0.25, 5, 4);

    if (contact) {
      ctx.fillStyle = '#ffe7aa';
      ctx.fillRect(hl-5,-hw-6,4,3); ctx.fillRect(hl+1,-hw-3,3,2);
    }
    // Taillights
    ctx.fillStyle = '#f00';
    ctx.fillRect(-hl + 1, -hw * 0.65, 5, 4);
    ctx.fillRect(-hl + 1,  hw * 0.25, 5, 4);

    ctx.restore();
  }

  /** Serialize state for network transmission. */
  serialize() {
    return {
      id:    this.id,
      x:     Math.round(this.x),
      y:     Math.round(this.y),
      angle: +this.angle.toFixed(4),
      speed: +this.speed.toFixed(2),
      lap:   this.lap,
    };
  }

  /** Apply a received network state snapshot. */
  applySnapshot(s) {
    this.x     = s.x;
    this.y     = s.y;
    this.angle = s.angle;
    this.speed = s.speed;
    this.lap   = s.lap;
  }
}

// ---------------------------------------------------------------------------
// Equal-mass oriented boxes, using the four separating axes of their footprints.
function extent(car, nx, ny) {
  const cos = Math.cos(car.angle), sin = Math.sin(car.angle);
  return .5 * (CAR_LENGTH * Math.abs(nx*cos + ny*sin) + CAR_WIDTH * Math.abs(ny*cos - nx*sin));
}
function recordImpact(car, approach) {
  if (approach < 75 || car.tick - car.impactTick < 9) return;
  car.impactTick = car.tick;
  car.impact = Math.min(2.6, approach/155);
}
export function containCar(car, dt = 0) {
  const road = roadFrame(car.x, car.y);
  const side = Math.sign(road.offset), nx = -road.ty*side, ny = road.tx*side;
  const depth = Math.abs(road.offset) + extent(car,nx,ny) - TRACK_WIDTH/2;
  if (depth <= 0) return;
  car.x -= nx*(depth+.04); car.y -= ny*(depth+.04);
  const approach = car.vx*nx + car.vy*ny;
  if (approach > 0) {
    recordImpact(car,approach);
    car.vx -= nx*approach; car.vy -= ny*approach;
    // Scrubbing the rail costs grip even at a shallow angle; braking for the corner is quicker.
    const drag = Math.exp(-2.5 * dt);
    car.vx *= drag; car.vy *= drag;
    car.speed = Math.hypot(car.vx,car.vy);
  }
  // Guide a nose pressed against a barrier into a slide. This also releases a stopped car.
  if (Math.cos(car.angle)*nx + Math.sin(car.angle)*ny > .66 && car.speed < 150) {
    const backward = Math.cos(car.angle)*road.tx + Math.sin(car.angle)*road.ty < -.35;
    const tangent = Math.atan2(road.ty,road.tx) + (backward ? Math.PI : 0);
    const turn = Math.atan2(Math.sin(tangent-car.angle),Math.cos(tangent-car.angle));
    car.angle += Math.max(-2.8*dt,Math.min(2.8*dt,turn));
  }
}

export function resolveCarCollision(a,b) {
  if (a.finished || b.finished || a.disconnected || b.disconnected) return;
  const dx=b.x-a.x, dy=b.y-a.y;
  if (dx*dx+dy*dy > CAR_LENGTH**2 + CAR_WIDTH**2) return;
  let depth=Infinity, nx=0, ny=0;
  for (const body of [a,b]) {
    for (const offset of [0,Math.PI/2]) {
      const ax=Math.cos(body.angle+offset), ay=Math.sin(body.angle+offset);
      const delta=dx*ax+dy*ay;
      const overlap=extent(a,ax,ay)+extent(b,ax,ay)-Math.abs(delta);
      if (overlap <= 0) return;
      if (overlap < depth) {
        const sign=delta < 0 ? -1 : 1;
        depth=overlap; nx=ax*sign; ny=ay*sign;
      }
    }
  }
  const correction=(depth+.02)*.5;
  a.x-=nx*correction; a.y-=ny*correction;
  b.x+=nx*correction; b.y+=ny*correction;
  const closing=(a.vx-b.vx)*nx+(a.vy-b.vy)*ny;
  if (closing > 0) {
    const impulse=.54*closing;
    a.vx-=nx*impulse; a.vy-=ny*impulse;
    b.vx+=nx*impulse; b.vy+=ny*impulse;
    for (const car of [a,b]) {
      car.speed=Math.hypot(car.vx,car.vy);
      recordImpact(car,closing);
    }
  }
  return true;
}
