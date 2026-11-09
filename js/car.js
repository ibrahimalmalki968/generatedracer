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
  MAX_SPEED, MAX_REVERSE_SPEED,
  ACCELERATION, BRAKING, COAST_FRICTION,
  TURN_RATE,
  OFFTRACK_SPEED_CAP, OFFTRACK_FRICTION_MULT,
  CAR_COLORS,
  TURBO_DURATION, TURBO_SPEED_MULT,
  TURBO_FLAME_BASE, TURBO_FLAME_RAND,
} from './constants.js';
import { isOnTrack } from './track.js';

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
    this.speed = 0;   // scalar forward speed (negative = reversing)

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
    const onTrack = isOnTrack(this.x, this.y);

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

    // ---- Speed / acceleration ------------------------------------------------
    const frictionMult = onTrack ? 1 : OFFTRACK_FRICTION_MULT;
    const friction     = COAST_FRICTION * frictionMult;
    if (this.input.brake > 0) {
      this.speed -= BRAKING * this.input.brake * dt;
    } else if (this.input.gas > 0) {
      this.speed += ACCELERATION * this.input.gas * dt;
    }

    // Coast friction always opposes motion
    if (this.speed > 0) {
      this.speed = Math.max(0, this.speed - friction * dt);
    } else if (this.speed < 0) {
      this.speed = Math.min(0, this.speed + friction * dt);
    }

    // Clamp speed (turbo raises the forward cap)
    const turboMult = this.turboActive ? TURBO_SPEED_MULT : 1;
    const maxFwd = onTrack
      ? MAX_SPEED * turboMult
      : MAX_SPEED * OFFTRACK_SPEED_CAP * turboMult;
    this.speed = Math.max(-MAX_REVERSE_SPEED, Math.min(maxFwd, this.speed));

    // ---- Steering ------------------------------------------------------------
    // Turn rate scales with |speed| / MAX_SPEED so it feels snappy at all speeds
    const speedFraction = Math.abs(this.speed) / MAX_SPEED;
    const effectiveTurn = TURN_RATE * speedFraction * Math.sign(this.speed);
    this.angle += this.input.steer * effectiveTurn * dt;

    // ---- Position update -----------------------------------------------------
    this.x += Math.cos(this.angle) * this.speed * dt;
    this.y += Math.sin(this.angle) * this.speed * dt;
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
  draw(ctx) {
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

    // Headlights
    ctx.fillStyle = '#fff';
    ctx.fillRect(hl - 6, -hw * 0.65, 5, 4);
    ctx.fillRect(hl - 6,  hw * 0.25, 5, 4);

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
// Collision resolution between two cars (circle approximation)
// ---------------------------------------------------------------------------
const COLLISION_RADIUS = (Math.max(CAR_LENGTH, CAR_WIDTH) / 2) * 1.1;

export function resolveCarCollision(a, b) {
  if (a.finished || b.finished || a.disconnected || b.disconnected) return;
  const dx  = b.x - a.x;
  const dy  = b.y - a.y;
  const distSq = dx * dx + dy * dy;
  const minDist = COLLISION_RADIUS * 2;

  if (distSq < minDist * minDist && distSq > 0) {
    const dist   = Math.sqrt(distSq);
    const nx     = dx / dist;
    const ny     = dy / dist;
    const push   = (minDist - dist) / 2;

    a.x -= nx * push;
    a.y -= ny * push;
    b.x += nx * push;
    b.y += ny * push;

    // Simple speed exchange along collision normal
    const relV  = (a.speed - b.speed) * 0.3;
    a.speed -= relV;
    b.speed += relV;
  }
}
