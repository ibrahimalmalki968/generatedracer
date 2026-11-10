import test from 'node:test';
import assert from 'node:assert/strict';
import { createGameServer } from '../server/server.js';
import { client } from './helpers/socket-client.mjs';
import { GATES } from '../js/race.js';
import { SIMULATION_STEP } from '../js/constants.js';

async function setup(t) {
  const s = await createGameServer({ countdownMs: 0, autoTick: false }); t.after(() => s.close());
  const player = await client(s.port, 'Solo customer'), visitor = await client(s.port, 'Visitor');
  return { s, player, visitor };
}
test('one solo action creates a private locked session and starts the existing six-car engine', async t => {
  const { s, player, visitor } = await setup(t);
  assert.equal(s.game.rooms.size, 0);
  assert.equal((await player.request({ type: 'solo' })).type, 'ack');
  const r = s.game.rooms.get(player.room().code);
  assert.equal(r.phase, 'countdown'); assert.equal(r.private, true); assert.equal(r.solo, true); assert.equal(r.members.size, 1);
  await visitor.request({ type: 'list' });
  assert.deepEqual(visitor.messages.filter(m => m.type === 'rooms').at(-1).rooms, []);
  assert.match((await visitor.request({ type: 'join', code: r.code })).message, /solo session/);
  assert.equal((await player.request({ type: 'solo' })).type, 'error'); assert.equal(s.game.rooms.size, 1);
  s.game.step();
  assert.equal(r.engine.cars.length, 6); assert.equal(r.engine.ai.length, 5);
  assert.equal(r.engine.cars.filter(c => c.isHuman).length, 1);
  assert.equal(r.engine.cars[0].participantId, player.welcome.playerId);
});
test('solo replay validates race identity, resets laps/Turbo and reuses the same private room', async t => {
  const { s, player } = await setup(t); await player.request({ type: 'solo' }); s.game.step();
  const r = s.game.rooms.get(player.room().code), oldId = r.raceId;
  const car = r.engine.cars[0]; car.turboUses = 3; car.turboAvailable = false;
  // Trusted gates isolate lifecycle; browser tests drive two full solo races physically.
  for (let lap = 0; lap < 3; lap++) for (const id of [1, 2, 3, 4, 5, 0]) {
    const g = GATES[id]; car.x = g.x - g.tx * 20; car.y = g.y - g.ty * 20; r.engine.race.update(SIMULATION_STEP);
    car.x = g.x + g.tx * 20; car.y = g.y + g.ty * 20; r.engine.race.update(SIMULATION_STEP);
  }
  s.game.step(); assert.equal(r.phase, 'results');
  assert.equal((await player.request({ type: 'solo', raceId: 'stale' })).type, 'error'); assert.equal(r.phase, 'results');
  assert.equal((await player.request({ type: 'solo', raceId: oldId })).type, 'ack');
  assert.notEqual(r.raceId, oldId); assert.equal(r.phase, 'countdown'); assert.equal(s.game.rooms.size, 1);
  assert.equal((await player.request({ type: 'solo', raceId: oldId })).type, 'error');
  s.game.step();
  assert.equal(r.engine.cars[0].lap, 0); assert.equal(r.engine.cars[0].turboUses, 0); assert.equal(r.engine.cars[0].turboAvailable, true);
  assert.equal(r.results, null); assert.equal(r.members.get(player.welcome.playerId).seq, 0);
});
test('cancel/leave removes quick solo; stale replay cannot create another room', async t => {
  const { s, player } = await setup(t); await player.request({ type: 'solo' }); const oldId = player.room().raceId;
  assert.equal((await player.request({ type: 'cancel' })).type, 'ack'); assert.equal(s.game.rooms.size, 0);
  assert.equal((await player.request({ type: 'solo', raceId: oldId })).type, 'error'); assert.equal(s.game.rooms.size, 0);
  assert.equal((await player.request({ type: 'solo' })).type, 'ack'); s.game.step();
  assert.equal((await player.request({ type: 'leave' })).type, 'ack'); assert.equal(s.game.rooms.size, 0);
});
test('solo action cannot convert a multiplayer room or let clients mark ordinary rooms solo', async t => {
  const { s, player, visitor } = await setup(t);
  await player.request({ type: 'create', name: 'Friends', private: false, solo: true });
  const r = s.game.rooms.get(player.room().code); assert.equal(r.solo, false);
  await visitor.request({ type: 'join', code: r.code });
  assert.equal((await player.request({ type: 'solo' })).type, 'error'); assert.equal(r.members.size, 2); assert.equal(r.phase, 'lobby');
  await player.request({ type: 'ready', ready: true }); await visitor.request({ type: 'ready', ready: true }); s.game.step();
  assert.equal(r.engine.cars.length, 2); assert.equal(r.engine.ai.length, 0);
});
