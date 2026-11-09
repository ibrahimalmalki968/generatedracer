import test from 'node:test';
import assert from 'node:assert/strict';
import { createGameServer } from '../server/server.js';
import { client } from './helpers/socket-client.mjs';
import { GATES } from '../js/race.js';
import { SIMULATION_STEP } from '../js/constants.js';

async function setup(t, count = 3) {
  const s = await createGameServer({ countdownMs: 0, autoTick: false }); t.after(() => s.close());
  const clients = await Promise.all(Array.from({ length: count }, (_, i) => client(s.port, `Racer ${i}`)));
  await clients[0].request({ type: 'create', name: 'Rematch room', private: true }); const code = clients[0].room().code;
  for (const c of clients.slice(1)) await c.request({ type: 'join', code });
  return { s, clients, code, room: s.game.rooms.get(code) };
}
async function start(g) {
  if (g.room.members.size === 1) await g.clients.find(c => g.room.members.has(c.welcome.playerId)).request({ type: 'start' });
  else for (const c of g.clients.filter(c => g.room.members.has(c.welcome.playerId))) await c.request({ type: 'ready', ready: true });
  g.s.game.step();
}
function finish(g, id) {
  const car = g.room.engine.cars[id], race = g.room.engine.race;
  // Trusted gate fixtures isolate lifecycle tests; complete physical socket races are in multiplayer.test.mjs.
  for (let lap = 0; lap < 3; lap++) for (const gateId of [1, 2, 3, 4, 5, 0]) {
    const gate = GATES[gateId];
    car.x = gate.x - gate.tx * 20; car.y = gate.y - gate.ty * 20; race.update(SIMULATION_STEP);
    car.x = gate.x + gate.tx * 20; car.y = gate.y + gate.ty * 20; race.update(SIMULATION_STEP);
  }
  g.s.game.step();
}

test('winner waits, finishing order and names agree on every client; finished cars cannot collide', async t => {
  const g = await setup(t), raceId = (await start(g), g.room.raceId);
  finish(g, 2); assert.equal(g.room.phase, 'racing'); assert.equal(g.room.engine.race.winnerId, 2);
  const x = g.room.engine.cars[2].x; g.s.game.step(); assert.equal(g.room.engine.cars[2].x, x);
  finish(g, 0); assert.equal(g.room.phase, 'racing'); finish(g, 1); assert.equal(g.room.phase, 'results');
  const received = await Promise.all(g.clients.map(c => c.until(m => m.type === 'room' && m.room.phase === 'results' && m.room.raceId === raceId)));
  assert.deepEqual(g.room.results.map(r => r.name), ['Racer 2', 'Racer 0', 'Racer 1']);
  for (const m of received) assert.deepEqual(m.room.results, g.room.results);
  const previous = JSON.stringify(g.room.results); g.s.game.finalize(g.room); assert.equal(JSON.stringify(g.room.results), previous);
  assert.ok(Object.isFrozen(g.room.results));
});
test('disconnect before finishing is DNF; disconnect after finishing retains place and time', async t => {
  const g = await setup(t); await start(g); finish(g, 0);
  const time = g.room.engine.race.getFinishTime(0);
  await g.clients[0].request({ type: 'leave' }); await g.clients[2].request({ type: 'leave' });
  assert.equal(g.room.phase, 'racing'); finish(g, 1);
  assert.equal(g.room.phase, 'results'); assert.equal(g.room.results[0].finishTime, time);
  assert.equal(g.room.results[0].status, 'finished');
  assert.equal(g.room.results[2].status, 'disconnected'); assert.equal(g.room.results[2].position, null);
});
test('last unfinished departure finalizes once without waiting or adding AI', async t => {
  const g = await setup(t, 2); await start(g); finish(g, 0);
  await g.clients[1].request({ type: 'leave' });
  assert.equal(g.room.phase, 'results'); assert.equal(g.room.engine.ai.length, 0);
  assert.equal(g.room.results[1].status, 'disconnected');
  assert.equal((await g.clients[0].request({ type: 'back', raceId: g.room.raceId })).type, 'ack');
  assert.equal(g.room.phase, 'lobby'); assert.equal(g.room.members.size, 1);
  await g.clients[0].request({ type: 'start' }); g.s.game.step(); assert.equal(g.room.engine.ai.length, 5);
});
test('three repeated same-room races reset all state, require readiness again, reject stale inputs', async t => {
  const g = await setup(t, 2); const races = new Set();
  for (let n = 0; n < 3; n++) {
    assert.equal(g.room.phase, 'lobby'); assert.ok([...g.room.members.values()].every(m => !m.ready && m.input.gas === 0));
    await start(g); const raceId = g.room.raceId; races.add(raceId);
    assert.ok(g.room.engine.cars.every(c => c.lap === 0 && c.turboUses === 0 && c.turboAvailable && !c.finished));
    finish(g, n % 2); assert.equal(g.room.phase, 'racing'); finish(g, 1 - n % 2);
    assert.equal(g.room.phase, 'results');
    await g.clients[0].request({ type: 'back', raceId });
    assert.equal(g.room.code, g.code); assert.equal(g.room.engine, null); assert.equal(g.room.results, null);
    g.clients[0].send({ type: 'input', raceId, seq: 999, boost: 999, gas: 1, brake: 0, steer: 1 });
    assert.equal((await g.clients[1].request({ type: 'back', raceId })).type, 'error');
    assert.equal(g.room.phase, 'lobby');
  }
  assert.equal(races.size, 3);
});
test('room reopens after results, new member resets readiness, old snapshots never become new race', async t => {
  const g = await setup(t, 2); await start(g); finish(g, 0); finish(g, 1);
  const before = g.room.raceId, newcomer = await client(g.s.port, 'New racer');
  assert.equal((await newcomer.request({ type: 'join', code: g.code })).type, 'error');
  await g.clients[0].request({ type: 'back', raceId: before });
  assert.equal((await newcomer.request({ type: 'join', code: g.code })).type, 'ack');
  assert.equal(g.room.members.size, 3); assert.ok([...g.room.members.values()].every(m => !m.ready));
  for (const c of [...g.clients, newcomer]) await c.request({ type: 'ready', ready: true });
  g.s.game.step(); assert.notEqual(g.room.raceId, before); assert.equal(g.room.engine.cars.length, 3);
});
