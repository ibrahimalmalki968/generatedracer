import { SEGMENTS, roadFrame } from './track.js';
import { MAX_SPEED } from './constants.js';

const clamp = (v,lo,hi) => Math.max(lo,Math.min(hi,v));
const ahead = (idx,steps) => SEGMENTS[(idx+steps) % SEGMENTS.length];
const bend = (a,b) => Math.atan2(a.tx*b.ty-a.ty*b.tx,a.tx*b.tx+a.ty*b.ty);

export class AiController {
  constructor(car, skill = .36) {
    this.car = car;
    this.skill = clamp(skill,0,1);
    this.lane = (car.id % 2 ? 1 : -1) * (12 + car.id*3);
    this.passSide = 0;
  }

  update(dt, traffic = []) {
    const c = this.car;
    if (c.isHuman || c.finished || c.disconnected) return;
    const road = roadFrame(c.x,c.y);
    const look = clamp(Math.round(3 + c.speed / 110),3,10);
    const target = ahead(road.idx,look);
    const entry = ahead(road.idx,3), exit = ahead(road.idx,14);
    const curve = bend(entry,exit);
    const crest = Math.max(Math.abs(bend(road,entry)), Math.abs(bend(entry,ahead(road.idx,9))), Math.abs(bend(ahead(road.idx,9),exit)));
    // Turn in toward the apex. Drivers differ in line and timing, within the same tire limits.
    const bias = (c.id % 2 ? 1 : -1) * (9 + c.id*2);
    const timing = Math.sin((road.idx + c.id*31) * .065) * (1-this.skill);
    let laneGoal = bias + clamp(curve*38,-40,40) + timing*11;
    let trafficBrake = 0, blocked = false, pursued = false;
    let obstacle = null, nearest = Infinity, leftClear = true, rightClear = true;
    for (const rival of Array.isArray(traffic) ? traffic : []) {
      if (rival === c || rival.finished || rival.disconnected) continue;
      const dx=rival.x-c.x, dy=rival.y-c.y;
      const forward=dx*road.tx + dy*road.ty, lateral=dy*road.tx-dx*road.ty;
      if (forward < -35 && forward > -125 && Math.abs(lateral)<35) pursued=true;
      if (forward < -55 || forward > 170) continue;
      if (lateral < -12 && lateral > -76) leftClear=false;
      if (lateral > 12 && lateral < 76) rightClear=false;
      if (forward > 0 && forward < nearest && Math.abs(lateral)<40) {
        obstacle = road.offset+lateral; nearest=forward;
      }
    }
    if (pursued && Math.abs(curve) > .27) laneGoal += Math.sign(curve)*12;
    if (obstacle !== null) {
      blocked=true;
      if (!this.passSide) this.passSide = obstacle > 0 ? -1 : 1;
      if (!leftClear && rightClear) this.passSide=1;
      if (!rightClear && leftClear) this.passSide=-1;
      laneGoal = obstacle + this.passSide*53;
      if (!leftClear && !rightClear && nearest<78) trafficBrake=.68;
    } else this.passSide=0;
    this.lane += (clamp(laneGoal,-70,70)-this.lane)*(1-Math.exp(-5*dt));
    const tx=target.x-target.ty*this.lane, ty=target.y+target.tx*this.lane;
    const desired=Math.atan2(ty-c.y,tx-c.x);
    const error=Math.atan2(Math.sin(desired-c.angle),Math.cos(desired-c.angle));
    const steer=clamp(error*(2.8+this.skill*.65),-1,1);
    const precision=.69+this.skill*.23+c.id*.008;
    const targetSpeed=MAX_SPEED*clamp(precision+.06-crest*.32-Math.abs(error)*.06+timing*.025,.43,1);
    const brake=Math.max(trafficBrake,clamp((c.speed-targetSpeed)/95,0,1));
    c.input={steer, gas: brake ? 0 : 1, brake,
      turbo:c.turboAvailable && !blocked && crest<.18 && Math.abs(error)<.15 && c.speed>265};
    // Commit to the boost on open exits. Brake normally if a tighter corner or traffic appears.
    if (c.turboActive && !blocked && crest<.25 && Math.abs(error)<.35) c.input.brake=0;
  }
}
