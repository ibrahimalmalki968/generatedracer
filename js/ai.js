/** Spline-following AI, using the existing proportional steering and speed factors. */
import { SPLINE_POINTS, nearestSplineIdx, trackProgress } from './track.js';
import { AI_LOOK_AHEAD, AI_STEER_GAIN, AI_SPEED_FACTORS, MAX_SPEED } from './constants.js';
export class AiController {
  constructor(car) { this.car = car; this._speedFactor = AI_SPEED_FACTORS[car.id] ?? 0.88; }
  update(_dt, playerProgress) {
    const car = this.car;
    if (car.isHuman || car.finished || car.disconnected) return;
    const idx = nearestSplineIdx(car.x, car.y);
    const target = SPLINE_POINTS[(idx + AI_LOOK_AHEAD) % SPLINE_POINTS.length];
    let err = Math.atan2(target.y - car.y, target.x - car.x) - car.angle;
    err = Math.atan2(Math.sin(err), Math.cos(err));
    const ownProgress = car.lap + trackProgress(car.x, car.y);
    const rubberBand = playerProgress === undefined ? 1 : Math.max(0.85, Math.min(1.1, 1 - (ownProgress - playerProgress) * 0.1));
    const targetSpeed = MAX_SPEED * this._speedFactor * rubberBand * (Math.abs(err) > 0.65 ? 0.72 : 1);
    const brake = car.speed > targetSpeed + 30 ? 0.4 : 0;
    car.input = { steer: Math.max(-1, Math.min(1, err * AI_STEER_GAIN)), gas: !brake && car.speed < targetSpeed ? 1 : 0,
      brake, turbo: car.turboAvailable && Math.abs(err) < 0.12 && car.speed > MAX_SPEED * 0.8 };
  }
}
