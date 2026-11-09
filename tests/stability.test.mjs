import test from 'node:test';
import assert from 'node:assert/strict';
import WebSocket from 'ws';
import { createGameServer } from '../server/server.js';
import { client } from './helpers/socket-client.mjs';
import { spawn } from 'node:child_process';

test('repeated room/connection cleanup remains bounded and expired sessions are removed', async t => {
  const s = await createGameServer(); t.after(() => s.close());
  for (let i = 0; i < 40; i++) {
    const c = await client(s.port, `Cycle ${i}`);
    assert.equal((await c.request({ type: 'create', private: i % 2 === 0 })).type, 'ack');
    assert.equal((await c.request({ type: 'leave' })).type, 'ack');
    c.ws.terminate();
  }
  await new Promise(r => setTimeout(r, 50));
  assert.equal(s.game.rooms.size, 0); assert.equal(s.wss.clients.size, 0); assert.equal(s.game.sessions.size, 40);
  for (const session of s.game.sessions.values()) session.touched = Date.now() - 11 * 60000;
  s.game.sweep(); assert.equal(s.game.sessions.size, 0);
});
test('HTTP exposes only client assets and health; private source and traversal stay unavailable', async t => {
  const s = await createGameServer(); t.after(() => s.close());
  const base = `http://127.0.0.1:${s.port}`;
  for (const [path, status] of [['/', 200], ['/health', 200], ['/LICENSE', 200], ['/shared/protocol.js', 200],
    ['/server/game.js', 404], ['/package-lock.json', 404], ['/.git/config', 404], ['/js/../../server/game.js', 404], ['/js/no.js', 404]]) {
    const r = await fetch(base + path); assert.equal(r.status, status, path); await r.text();
  }
});
test('cross-origin WebSocket upgrades and unauthenticated actions are rejected', async t => {
  const s = await createGameServer(); t.after(() => s.close());
  const denied = new WebSocket(`ws://127.0.0.1:${s.port}/socket`, { origin: 'https://untrusted.example' });
  await assert.rejects(new Promise((resolve, reject) => { denied.on('open', resolve); denied.on('error', reject); }), /403/);
  const ws = new WebSocket(`ws://127.0.0.1:${s.port}/socket`);
  await new Promise(resolve => ws.once('open', resolve));
  const response = new Promise(resolve => ws.once('message', m => resolve(JSON.parse(m))));
  ws.send('{"type":"create","private":false}');
  assert.match((await response).message, /nickname first/); ws.terminate();
});
test('oversize payload closes one connection without bringing down the server', async t => {
  const s = await createGameServer(); t.after(() => s.close()); const c = await client(s.port);
  const closed = new Promise(resolve => c.ws.once('close', code => resolve(code)));
  c.ws.send('x'.repeat(5000)); assert.equal(await closed, 1009);
  const other = await client(s.port, 'Still racing'); assert.equal(other.welcome.nickname, 'Still racing');
});
test('launcher rejects occupied preview port and invalid configuration with a clear error', async t => {
  const s = await createGameServer(); t.after(() => s.close());
  const launch = port => new Promise(resolve => {
    const child = spawn(process.execPath, ['server/server.js'], { env: { ...process.env, PORT: String(port), HOST: '0.0.0.0' }, windowsHide: true });
    let output = ''; child.stderr.on('data', d => { output += d; }); child.on('exit', code => resolve({ code, output }));
  });
  const busy = await launch(s.port); assert.equal(busy.code, 1); assert.match(busy.output, /in use/);
  const invalid = await launch('invalid'); assert.equal(invalid.code, 1); assert.match(invalid.output, /PORT must be/);
});
