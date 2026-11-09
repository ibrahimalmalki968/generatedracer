import test from 'node:test';
import assert from 'node:assert/strict';
import { createGameServer } from '../server/server.js';
import { client } from './helpers/socket-client.mjs';
import { displayName } from '../shared/protocol.js';

async function setup(t, options = {}) { const s = await createGameServer({ countdownMs: 100, ...options }); t.after(() => s.close()); return s; }
async function create(s, nickname = 'Host', privacy = false) {
  const c = await client(s.port, nickname); await c.request({ type: 'create', private: privacy, name: `${nickname}'s room` }); return c;
}
test('nicknames normalize safely and enforce length; markup remains display-only', () => {
  assert.equal(displayName('  Racer\n  One  '), 'Racer One');
  assert.equal(displayName('عُمان'), 'عُمان'); assert.equal(displayName('<img onerror=x>'), '<img onerror=x>');
  assert.throws(() => displayName('')); assert.throws(() => displayName('x'.repeat(21))); assert.throws(() => displayName({}));
});
test('public discovery omits private rooms and reports accurate count/capacity', async t => {
  const s = await setup(t), pub = await create(s, 'Public'), secret = await create(s, 'Secret', true), browser = await client(s.port);
  await browser.request({ type: 'list' });
  const list = [...browser.messages].reverse().find(m => m.type === 'rooms').rooms;
  assert.equal(list.length, 1); assert.equal(list[0].code, pub.room().code); assert.equal(list[0].count, 1); assert.equal(list[0].capacity, 6);
  assert.equal((await browser.request({ type: 'join', code: secret.room().code.toLowerCase() })).type, 'ack');
  assert.equal(browser.room().private, true);
});
test('one human waits indefinitely until explicit Start; solo creates five AI', async t => {
  const s = await setup(t), c = await create(s);
  await new Promise(r => setTimeout(r, 250)); assert.equal(c.room().phase, 'lobby');
  assert.equal((await c.request({ type: 'start' })).type, 'ack');
  await c.until(m => m.type === 'snapshot'); const r = s.game.rooms.get(c.room().code);
  assert.equal(r.engine.humans, 1); assert.equal(r.engine.ai.length, 5); assert.equal(r.engine.cars.length, 6);
});
test('room capacity is exactly six and invalid/expired codes fail clearly', async t => {
  const s = await setup(t), host = await create(s), code = host.room().code;
  const guests = await Promise.all(Array.from({ length: 6 }, (_, i) => client(s.port, `Guest ${i}`)));
  for (const c of guests.slice(0, 5)) assert.equal((await c.request({ type: 'join', code })).type, 'ack');
  assert.match((await guests[5].request({ type: 'join', code })).message, /full/);
  assert.match((await guests[5].request({ type: 'join', code: 'bad' })).message, /Invalid room code/);
  assert.match((await guests[5].request({ type: 'join', code: '0000000000' })).message, /not found or expired/);
  assert.equal(s.game.rooms.get(code).members.size, 6);
});
test('multiplayer needs every Ready; roster changes reset readiness; solo start cannot bypass it', async t => {
  const s = await setup(t), host = await create(s), guest = await client(s.port, 'Guest');
  await host.request({ type: 'start' }); // cancel before commitment to join another member
  await host.request({ type: 'cancel' });
  await guest.request({ type: 'join', code: host.room().code });
  assert.equal((await host.request({ type: 'start' })).type, 'error');
  await host.request({ type: 'ready', ready: true }); assert.equal(host.room().phase, 'lobby');
  const third = await client(s.port, 'Third'); await third.request({ type: 'join', code: host.room().code });
  assert.ok(third.room().players.every(p => !p.ready));
  for (const c of [host, guest, third]) await c.request({ type: 'ready', ready: true });
  await host.until(m => m.type === 'room' && m.room.phase === 'racing'); assert.equal(s.game.rooms.get(host.room().code).engine.cars.length, 3);
});
test('unready cancels countdown and identical Ready commands do not extend it', async t => {
  const s = await setup(t, { countdownMs: 400 }), host = await create(s), guest = await client(s.port, 'Guest');
  await guest.request({ type: 'join', code: host.room().code });
  await host.request({ type: 'ready', ready: true }); await guest.request({ type: 'ready', ready: true });
  const r = s.game.rooms.get(host.room().code), deadline = r.startAt;
  await guest.request({ type: 'ready', ready: true }); assert.equal(r.startAt, deadline);
  await guest.request({ type: 'ready', ready: false });
  await new Promise(r => setTimeout(r, 450)); assert.equal(r.phase, 'lobby'); assert.equal(r.engine, null);
});
test('join locks at countdown and while racing; public availability updates when cancelled', async t => {
  const s = await setup(t, { countdownMs: 300 }), host = await create(s), outsider = await client(s.port, 'Outsider');
  const code = host.room().code; await host.request({ type: 'start' });
  assert.match((await outsider.request({ type: 'join', code })).message, /Race in Progress/);
  await outsider.request({ type: 'list' });
  assert.equal([...outsider.messages].reverse().find(m => m.type === 'rooms').rooms[0].available, false);
  await host.request({ type: 'cancel' });
  await outsider.until(m => m.type === 'rooms' && m.rooms[0]?.available);
  await host.request({ type: 'start' }); await host.until(m => m.type === 'room' && m.room.phase === 'racing');
  assert.match((await outsider.request({ type: 'join', code })).message, /Race in Progress/);
});
test('leaving countdown safely cancels and never starts an outdated roster', async t => {
  const s = await setup(t, { countdownMs: 250 }), host = await create(s), guest = await client(s.port, 'Guest');
  const code = host.room().code; await guest.request({ type: 'join', code });
  await host.request({ type: 'ready', ready: true }); await guest.request({ type: 'ready', ready: true });
  await guest.request({ type: 'leave' }); await new Promise(r => setTimeout(r, 300));
  const room = s.game.rooms.get(code); assert.equal(room.phase, 'lobby'); assert.equal(room.members.size, 1); assert.equal(room.engine, null);
});
test('empty rooms are removed; token session retention has a bounded expiry', async t => {
  const s = await setup(t), host = await create(s), code = host.room().code;
  await host.request({ type: 'leave' }); assert.equal(s.game.rooms.has(code), false);
  host.ws.terminate(); await new Promise(r => setTimeout(r, 30));
  for (const session of s.game.sessions.values()) session.touched = Date.now() - 11 * 60000;
  s.game.sweep(); assert.equal(s.game.sessions.size, 0);
});
