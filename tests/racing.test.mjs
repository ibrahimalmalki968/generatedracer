import test from 'node:test';
import assert from 'node:assert/strict';
import { Car, resolveCarCollision } from '../js/car.js';
import { RaceManager, GATES, crossingFraction } from '../js/race.js';
import { LocalSession } from '../js/simulation.js';
import { AiController } from '../js/ai.js';
import { SPLINE_POINTS, trackProgress } from '../js/track.js';
import { SIMULATION_STEP, TURBO_DURATION, NUM_LAPS } from '../js/constants.js';

const car = (id = 0) => new Car(id, 1490, 268);
const cross = (race, c, gateId, reverse = false, offset = 0) => {
  const g = GATES[gateId], direction = reverse ? -1 : 1;
  c.x = g.x - g.tx * 20 * direction - g.ty * offset;
  c.y = g.y - g.ty * 20 * direction + g.tx * offset;
  race.update(SIMULATION_STEP); // fixture relocation is too far to count as a crossing
  c.x = g.x + g.tx * 20 * direction - g.ty * offset;
  c.y = g.y + g.ty * 20 * direction + g.tx * offset;
  race.update(SIMULATION_STEP);
};
const lap = (race, c) => { for (const g of [1, 2, 3, 4, 5, 0]) cross(race, c, g); };

test('exactly three laps: ordered forward gates count once and finish', () => {
  const c = car(), r = new RaceManager([c]); r.start();
  cross(r, c, 0); assert.equal(c.lap, 0);
  lap(r, c); assert.equal(c.lap, 1); assert.equal(r.finished, false);
  lap(r, c); assert.equal(c.lap, 2); assert.equal(r.finished, false);
  lap(r, c); assert.equal(c.lap, NUM_LAPS); assert.equal(r.finished, true);
  const elapsed = r.elapsed; lap(r, c); assert.equal(c.lap, 3); assert.equal(r.elapsed, elapsed);
});
test('skipped, unordered, reverse, far-side and long teleport crossings do not grant laps', () => {
  const c = car(), r = new RaceManager([c]); r.start();
  for (const g of [5, 4, 3, 2, 0]) cross(r, c, g);
  assert.equal(r.getLap(0), 0); assert.equal(r._state[0].nextCheckpoint, 1);
  cross(r, c, 1, true); assert.equal(r._state[0].nextCheckpoint, 1);
  cross(r, c, 1, false, 250); assert.equal(r._state[0].nextCheckpoint, 1);
  const g = GATES[1];
  c.x = g.x - g.tx * 1000; c.y = g.y - g.ty * 1000; r.update(SIMULATION_STEP);
  c.x = g.x + g.tx * 1000; c.y = g.y + g.ty * 1000; r.update(SIMULATION_STEP);
  assert.equal(r._state[0].nextCheckpoint, 1);
});
test('winner does not stop a second connected human; final results remain consistent', () => {
  const a = car(0), b = car(1), r = new RaceManager([a, b]); r.start();
  for (let i = 0; i < 3; i++) lap(r, b);
  assert.equal(r.winnerId, 1); assert.equal(r.finished, false); assert.equal(a.lap, 0);
  for (let i = 0; i < 3; i++) lap(r, a);
  assert.equal(r.finished, true); assert.deepEqual(r.getResults().map(x => x.id), [1, 0]);
  assert.ok(r.getFinishTime(0) > r.getFinishTime(1));
});
test('unfinished disconnected human cannot block completion; finished disconnect preserves place', () => {
  const a = car(), b = car(1), r = new RaceManager([a, b]); r.start();
  r.disconnect(1); for (let i = 0; i < 3; i++) lap(r, a);
  assert.equal(r.finished, true); assert.equal(r.getResults()[1].status, 'disconnected');
  r.disconnect(0); assert.equal(r.getResults()[0].status, 'finished');
});
test('same-step finish order follows crossing fraction rather than car array order', () => {
  const a = car(0), b = car(1), r = new RaceManager([a, b]); r.start();
  for (const c of [a, b]) {
    lap(r, c); lap(r, c); for (const g of [1, 2, 3, 4, 5]) cross(r, c, g);
  }
  const g = GATES[0];
  for (const [c, distance] of [[a, -20], [b, -5]]) { c.x = g.x + g.tx * distance; c.y = g.y + g.ty * distance; }
  r.update(SIMULATION_STEP);
  for (const [c, distance] of [[a, 20], [b, 25]]) { c.x = g.x + g.tx * distance; c.y = g.y + g.ty * distance; }
  r.update(SIMULATION_STEP);
  assert.equal(r.winnerId, 1); assert.equal(r.finished, true);
  assert.deepEqual(r.getResults().map(x => x.id), [1, 0]);
});
test('lap crossings grant a new Turbo and final finish grants none', () => {
  const c = car(), r = new RaceManager([c]); r.start();
  for (let i = 0; i < 3; i++) {
    c.input = { gas: 0, brake: 0, steer: 0, turbo: false }; c.update(SIMULATION_STEP);
    c.input.turbo = true; c.update(SIMULATION_STEP); assert.equal(c.turboAvailable, false);
    lap(r, c); assert.equal(c.turboActive, false); assert.equal(c.turboAvailable, i < 2);
  }
  assert.equal(c.turboUses, 3);
});
test('no race expiration, and duplicate start does not reset the clock', () => {
  const r = new RaceManager([car()]); r.start();
  r.update(60 * 60 * 24); r.start(); assert.equal(r.elapsed, 86400000); assert.equal(r.finished, false);
});
test('Turbo has one use per lap, never recharges by time, max three uses', () => {
  const c = car();
  for (let lapNo = 0; lapNo < 3; lapNo++) {
    c.beginLap(lapNo); c.input = { gas: 1, brake: 0, steer: 0, turbo: false }; c.update(SIMULATION_STEP);
    c.input.turbo = true; c.update(SIMULATION_STEP);
    assert.equal(c.turboUses, lapNo + 1); assert.equal(c.turboAvailable, false);
    for (let j = 0; j < 60 * 30; j++) c.update(SIMULATION_STEP);
    assert.equal(c.turboActive, false); assert.equal(c.turboAvailable, false);
    c.input.turbo = false; c.update(SIMULATION_STEP); c.input.turbo = true; c.update(SIMULATION_STEP);
    assert.equal(c.turboUses, lapNo + 1);
  }
  c.finished = true; c.beginLap(3); assert.equal(c.turboAvailable, false);
});
test('unused Turbo expires without stacking; held Turbo cannot spend a new lap grant', () => {
  const c = car(); c.beginLap(1); c.beginLap(2);
  c.input.turbo = true; c.update(SIMULATION_STEP); assert.equal(c.turboUses, 1);
  c.beginLap(2); c.update(SIMULATION_STEP); assert.equal(c.turboUses, 1);
  assert.equal(c.turboAvailable, true); assert.equal(c.turboActive, false);
});
test('Turbo duration is bounded; finished cars cannot move or collide', () => {
  const c = car(); c.input.turbo = true;
  for (let j = 0; j < Math.ceil(TURBO_DURATION / SIMULATION_STEP) + 1; j++) c.update(SIMULATION_STEP);
  assert.equal(c.turboActive, false);
  const b = car(1); c.finished = true; c.speed = 500; const x = c.x;
  c.update(SIMULATION_STEP); resolveCarCollision(c, b); assert.equal(c.x, x); assert.equal(c.speed, 0);
});
test('braking overrides acceleration', () => {
  const c = car(); c.speed = 200; c.input = { gas: 1, brake: 1, steer: 0, turbo: false };
  c.update(SIMULATION_STEP); assert.ok(c.speed < 200);
});
test('solo has five AI; local two-human race has only two humans; AI cannot override a human', () => {
  const solo = new LocalSession(1), split = new LocalSession(2);
  assert.equal(solo.cars.length, 6); assert.equal(solo.ai.length, 5);
  assert.equal(split.cars.length, 2); assert.equal(split.ai.length, 0);
  const c = car(); c.input.steer = -1; new AiController(c).update(SIMULATION_STEP, 0);
  assert.equal(c.input.steer, -1);
});
test('fresh session resets laps, Turbo, clock and finish state', () => {
  const old = new LocalSession(); old.start(); old.step(SIMULATION_STEP, [{ gas: 1, steer: 0, brake: 0, turbo: true }]);
  const fresh = new LocalSession(); assert.equal(fresh.race.elapsed, 0); assert.equal(fresh.cars[0].lap, 0);
  assert.equal(fresh.cars[0].turboUses, 0); assert.equal(fresh.cars[0].turboAvailable, true); assert.equal(fresh.cars[0].speed, 0);
});
test('AI opponents physically drive three valid laps, without stopping an unfinished human', () => {
  const s = new LocalSession(); s.start();
  for (let tick = 0; tick < 60 * 180; tick++) s.step(SIMULATION_STEP);
  assert.ok(s.cars.slice(1).every(c => c.finished), JSON.stringify(s.cars.map(c => ({ id: c.id, lap: c.lap, x: c.x, y: c.y }))));
  assert.equal(s.race.finished, false); assert.notEqual(s.race.winnerId, null);
});
test('a scripted physical driver can complete a solo race with the same physics and gates', () => {
  const s = new LocalSession(), player = s.cars[0]; s.start();
  // The controller is an external test driver, not a production AI on a human slot.
  const driverCar = new Car(0, player.x, player.y, player.angle, { isHuman: false });
  const driver = new AiController(driverCar);
  for (let tick = 0; tick < 60 * 180 && !s.race.finished; tick++) {
    Object.assign(driverCar, { x: player.x, y: player.y, angle: player.angle, speed: player.speed, lap: player.lap, turboAvailable: player.turboAvailable });
    driver.update(SIMULATION_STEP, player.lap + trackProgress(player.x, player.y));
    s.step(SIMULATION_STEP, [{ ...driverCar.input }]);
  }
  assert.equal(player.lap, 3); assert.equal(s.race.finished, true); assert.ok(player.turboUses <= 3);
});
test('swept gate handles a valid crossing between frames', () => {
  const g = GATES[0];
  assert.equal(crossingFraction({ x: g.x - g.tx * 10, y: g.y - g.ty * 10 },
    { x: g.x + g.tx * 10, y: g.y + g.ty * 10 }, g), 0.5);
  assert.equal(SPLINE_POINTS.length, 384);
});
