import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Car } from '../js/car.js';
import { SIMULATION_STEP as dt } from '../js/constants.js';
import { RaceManager } from '../js/race.js';
import { roadFrame, SEGMENTS } from '../js/track.js';

for (const [speed, maxRadius] of [[60, 35], [350, 130], [500, 200]]) {
  test(`full-lock turning radius at ${speed} stays within ${maxRadius} world units`, () => {
    for (const side of [-1, 1]) {
      const kart = new Car(0, 1500, 300);
      kart.speed = kart.vx = speed;
      kart.rack = kart.input.steer = side;
      kart.update(dt);
      assert.ok(kart.angle * side > 0);
      assert.ok(kart.speed * dt / Math.abs(kart.angle) < maxRadius);
    }
  });
}

for (const decisionTicks of [8, 12, 15]) {
  test(`three laps with digital buttons sampled every ${decisionTicks} ticks`, () => {
    // The driver can only tap, hold and release, like a player's two steering buttons.
    // Use the shipped track, real barrier response and all ordered finish gates.
    const kart = new Car(0, 1500, 300);
    const race = new RaceManager([kart]);
    race.start();
    let impacts = 0;
    for (let tick = 0; tick < 7200 && !kart.finished; tick++) {
      if (tick % decisionTicks === 0) {
        const road = roadFrame(kart.x, kart.y);
        const target = SEGMENTS[(road.idx + 7) % SEGMENTS.length];
        const delta = Math.atan2(target.y - kart.y, target.x - kart.x) - kart.angle;
        const error = Math.atan2(Math.sin(delta), Math.cos(delta));
        kart.input.steer = Math.abs(error) > .16 ? Math.sign(error) : 0;
      }
      kart.update(dt);
      race.update(dt);
      if (kart.impactTick === kart.tick) impacts++;
    }
    assert.equal(kart.lap, 3);
    assert.ok(impacts <= 2, `Recorded ${impacts} barrier strikes`);
  });
}

test('a short brake press tightens a held turn and releasing steer settles the heading', () => {
  const coast = new Car(0, 1500, 300);
  const braked = new Car(0, 1500, 300);
  for (const kart of [coast, braked]) {
    kart.speed = kart.vx = 480;
    kart.input.steer = 1;
    kart.input.brake = Number(kart === braked);
    for (let tick = 0; tick < 18; tick++) kart.update(dt);
  }
  assert.ok(braked.speed < coast.speed - 100);
  assert.ok(braked.angle > coast.angle);
  braked.input.brake = braked.input.steer = 0;
  for (let tick = 0; tick < 6; tick++) braked.update(dt);
  assert.equal(braked.rack, 0);
  const heading = braked.angle;
  braked.update(dt);
  assert.equal(braked.angle, heading);
});

test('one steering hold frees the kart after a square hit on either barrier', () => {
  for (const side of [-1, 1]) {
    const kart = new Car(0, 1500, 300 + side * 92, side * Math.PI / 2);
    kart.speed = 360;
    kart.vy = side * kart.speed;
    for (let tick = 0; tick < 90; tick++) {
      kart.input.steer = tick >= 4 && tick < 39 ? -side : 0;
      kart.update(dt);
    }
    assert.equal(kart.impactTick, 1, 'one impact, without repeated strikes');
    assert.ok(kart.x > 1660 && kart.speed > 200);
    assert.ok(Math.abs(roadFrame(kart.x, kart.y).offset) < 65);
  }
});
