import test from 'node:test';
import assert from 'node:assert/strict';
import { createGameServer } from '../server/server.js';
import { client } from './helpers/socket-client.mjs';
import { AiController } from '../js/ai.js';
import { Car } from '../js/car.js';

async function server(t, options) { const s = await createGameServer({ countdownMs: 40, ...options }); t.after(() => s.close()); return s; }
async function group(s, n, prefix = 'Driver') {
  const clients = await Promise.all(Array.from({ length: n }, (_, i) => client(s.port, `${prefix} ${i}`)));
  await clients[0].request({ type: 'create', name: `${prefix} room`, private: false });
  const code = clients[0].room().code;
  for (const c of clients.slice(1)) assert.equal((await c.request({ type: 'join', code })).type, 'ack');
  return { clients, code };
}
async function ready(clients) {
  for (const c of clients) await c.request({ type: 'ready', ready: true });
  await Promise.all(clients.map(c => c.until(m => m.type === 'room' && m.room.phase === 'racing')));
}

for (const count of [2, 3, 4, 5, 6]) test(`${count} real WebSocket humans: correct roster, ownership, movement and Turbo`, async t => {
  const s = await server(t), { clients, code } = await group(s, count);
  await ready(clients);
  const room = s.game.rooms.get(code), raceId = room.raceId;
  for (let seq = 1; seq <= 15; seq++) {
    for (let i = 0; i < count; i++) clients[i].send({ type: 'input', raceId, seq, boost: 1, gas: 1, brake: 0, steer: i % 2 ? 0.2 : -0.2 });
    await new Promise(r => setTimeout(r, 18));
  }
  await clients[0].until(m => m.type === 'snapshot' && m.cars.every(c => c.speed > 40 && c.turboUses === 1));
  assert.equal(room.engine.cars.length, count); assert.equal(room.engine.ai.length, 0);
  assert.equal(new Set(room.engine.cars.map(c => c.participantId)).size, count);
  const before = room.engine.cars[1].x;
  assert.equal((await clients[0].request({ type: 'state', lap: 3, carId: 1 })).type, 'error');
  clients[0].send({ type: 'input', raceId, seq: 999, boost: 2, gas: 1, brake: 0, steer: 99, carId: 1 });
  await clients[0].until(m => m.type === 'error' && m.message === 'Invalid control input.');
  assert.equal(room.engine.cars[0].lap, 0); assert.ok(room.engine.cars[1].x >= before - 10);
  assert.ok(room.engine.cars.every(c => c.turboUses === 1));
});

test('concurrent rooms are isolated; stale race packets cannot affect another session', async t => {
  const s = await server(t), a = await group(s, 2, 'A'), b = await group(s, 2, 'B');
  await ready(a.clients); await ready(b.clients);
  const ar = s.game.rooms.get(a.code), br = s.game.rooms.get(b.code);
  const before = br.engine.cars[0].x;
  a.clients[0].send({ type: 'input', raceId: br.raceId, seq: 1, boost: 1, gas: 1, brake: 0, steer: 0 });
  await new Promise(r => setTimeout(r, 100));
  assert.equal(ar.engine.cars[0].turboUses, 0); assert.equal(br.engine.cars[0].x, before);
  assert.notEqual(ar.engine.race, br.engine.race);
});

test('disconnect is DNF, neutral input expires, no AI replacement and last departure removes room', async t => {
  const s = await server(t), { clients, code } = await group(s, 2); await ready(clients);
  const room = s.game.rooms.get(code);
  clients[0].send({ type: 'input', raceId: room.raceId, seq: 1, boost: 0, gas: 1, brake: 0, steer: 0 });
  await new Promise(r => setTimeout(r, 850));
  assert.equal(room.members.get(clients[0].welcome.playerId).input.gas, 1);
  assert.equal(room.engine.cars[0].input.gas, 0);
  clients[1].ws.terminate();
  await clients[0].until(m => m.type === 'snapshot' && m.cars[1].disconnected);
  assert.equal(room.phase, 'racing'); assert.equal(room.engine.ai.length, 0); assert.equal(room.engine.cars.length, 2);
  clients[0].ws.terminate(); await new Promise(r => setTimeout(r, 50)); assert.equal(s.game.rooms.has(code), false);
});

test('malformed messages do not crash server; input floods are bounded; unauthenticated cannot create', async t => {
  const s = await server(t), c = await client(s.port);
  c.ws.send('{'); await c.until(m => m.type === 'error' && m.message === 'Invalid JSON.');
  assert.equal((await c.request({ type: 'create', private: true })).type, 'ack');
  for (let i = 0; i < 300; i++) c.send({ type: 'input' });
  await new Promise(resolve => c.ws.once('close', resolve));
  const replacement = await client(s.port, 'Still alive'); assert.equal(replacement.welcome.nickname, 'Still alive');
});

test('reconnecting token preserves identity but cannot rejoin an active race after DNF', async t => {
  const s = await server(t), { clients, code } = await group(s, 2); await ready(clients);
  const identity = clients[1].welcome;
  clients[1].ws.terminate(); await new Promise(r => setTimeout(r, 50));
  const reconnected = await client(s.port, 'Driver 1', identity.token);
  assert.equal(reconnected.welcome.playerId, identity.playerId);
  const response = await reconnected.request({ type: 'join', code });
  assert.equal(response.type, 'error'); assert.match(response.message, /Race in Progress/);
});

test('delayed controls are current-race only, duplicate sequence and boost cannot spend extra Turbo', async t => {
  const s = await server(t), { clients, code } = await group(s, 2); await ready(clients);
  const room = s.game.rooms.get(code);
  await new Promise(r => setTimeout(r, 120));
  const message = { type: 'input', raceId: room.raceId, seq: 1, boost: 1, gas: 1, brake: 0, steer: 0 };
  clients[0].send(message); clients[0].send(message);
  await clients[0].until(m => m.type === 'snapshot' && m.cars[0].turboUses === 1);
  assert.equal(room.engine.cars[0].turboUses, 1);
});

test('2–6 human full physical races over real sockets agree on laps and final standings', { timeout: 120000 }, async t => {
  const s = await server(t);
  const groups = await Promise.all([2, 3, 4, 5, 6].map(n => group(s, n, `Finish${n}`)));
  await Promise.all(groups.map(g => ready(g.clients)));
  const seq = new Map(), boosts = new Map(), held = new Map();
  const timer = setInterval(() => {
    for (const g of groups) {
      const r = s.game.rooms.get(g.code);
      if (r.phase !== 'racing') continue;
      g.clients.forEach((c, i) => {
        const car = r.engine.cars[i]; if (car.finished) return;
        const ghost = new Car(i, car.x, car.y, car.angle, { isHuman: false });
        Object.assign(ghost, { speed: car.speed, lap: car.lap, turboAvailable: car.turboAvailable });
        new AiController(ghost).update(1 / 60);
        if (ghost.input.turbo && !held.get(c)) boosts.set(c, (boosts.get(c) || 0) + 1);
        held.set(c, ghost.input.turbo); seq.set(c, (seq.get(c) || 0) + 1);
        c.send({ type: 'input', raceId: r.raceId, seq: seq.get(c), boost: boosts.get(c) || 0,
          gas: ghost.input.gas, brake: ghost.input.brake, steer: ghost.input.steer });
      });
    }
  }, 17);
  t.after(() => clearInterval(timer));
  for (const g of groups) {
    const results = await Promise.all(g.clients.map(c => c.until(m => m.type === 'room' && m.room.phase === 'results', 100000)));
    const reference = results[0].room.results;
    assert.ok(reference.every(r => r.lap === 3 && r.status === 'finished'));
    for (const result of results) assert.deepEqual(result.room.results, reference);
    assert.deepEqual(reference.map(r => r.position), Array.from({ length: g.clients.length }, (_, i) => i + 1));
    assert.ok(s.game.rooms.get(g.code).engine.cars.every(c => c.turboUses <= 3));
  }
});
