import test from 'node:test';
import assert from 'node:assert/strict';
import WebSocket from 'ws';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { createGameServer } from '../server/server.js';
import { configuredOrigin, allowedOrigin, connectionBudget } from '../server/security.js';

test('encoded Windows separators and mixed traversal never expose server JavaScript', async t => {
  const s = await createGameServer(); t.after(() => s.close());
  for (const path of ['/js/lib%5c..%5c..%5cserver%5cgame.js', '/js/lib%5C..%5C..%5Cserver%5Csecurity.js',
    '/js/lib%2f..%2f..%2fserver%2fgame.js', '/shared/x%5c..%5c..%5cserver%5cgame.js']) {
    assert.equal((await fetch(`http://127.0.0.1:${s.port}${path}`)).status, 404, path);
  }
  assert.equal((await fetch(`http://127.0.0.1:${s.port}/js/lib/qrcode.js`)).status, 200);
});

test('origin checks pin HTTPS production domain and ignore forged forwarded headers', async t => {
  const s = await createGameServer({ production: true, publicOrigin: 'https://racer.example' });
  t.after(() => s.close());
  const connect = (origin, headers) => new Promise((resolve, reject) => {
    const ws = new WebSocket(`ws://127.0.0.1:${s.port}/socket`, { origin, headers });
    ws.once('open', () => { ws.terminate(); resolve(); }); ws.once('error', reject);
  });
  await connect('https://racer.example'); // TLS terminates at provider; upstream is HTTP.
  await connect(undefined); // Native clients still need a server-issued session.
  for (const origin of ['https://evil.example', 'http://racer.example', 'null', 'https://racer.example/path']) {
    await assert.rejects(connect(origin, { 'X-Forwarded-Host': 'racer.example', 'X-Forwarded-Proto': 'https' }), /403/);
  }
  assert.equal(allowedOrigin('https://local.example', 'local.example', null, true), true);
  assert.equal(allowedOrigin('http://local.example', 'local.example', null, true), false);
  for (const value of ['http://racer.example', 'https://user:pass@racer.example', 'https://racer.example/path', 'file:///x']) {
    assert.throws(() => configuredOrigin(value, true));
  }
});

test('connection admission is bounded, refills and returns actual HTTP 429 on floods', async t => {
  let now = 0; const admit = connectionBudget({ burst: 2, perSecond: 1, now: () => now });
  assert.equal(admit(), true); assert.equal(admit(), true); assert.equal(admit(), false);
  now = 999; assert.equal(admit(), false); now = 1000; assert.equal(admit(), true);
  const s = await createGameServer(); t.after(() => s.close());
  const result = await Promise.all(Array.from({ length: 45 }, () => new Promise(resolve => {
    const ws = new WebSocket(`ws://127.0.0.1:${s.port}/socket`);
    ws.once('open', () => { ws.terminate(); resolve('accepted'); }); ws.once('error', e => resolve(e.message));
  })));
  assert.ok(result.some(value => /429/.test(value)), 'burst must be denied');
  assert.equal((await fetch(`http://127.0.0.1:${s.port}/health`)).status, 200);
});

test('production launcher honors assigned PORT, serves protected assets and shuts down', async t => {
  const probe = createServer(); await new Promise(r => probe.listen(0, '127.0.0.1', r));
  const port = probe.address().port; await new Promise(r => probe.close(r));
  const child = spawn(process.execPath, ['server/server.js'], { windowsHide: true,
    env: { ...process.env, HOST: '0.0.0.0', PORT: String(port), NODE_ENV: 'production', PUBLIC_ORIGIN: 'https://racer.example' } });
  let output = ''; child.stdout.on('data', b => { output += b; }); child.stderr.on('data', b => { output += b; });
  const exit = new Promise(resolve => child.once('exit', resolve));
  t.after(async () => { if (child.exitCode === null) child.kill(); await exit; });
  const base = `http://127.0.0.1:${port}`;
  let healthy = false;
  for (let i = 0; i < 100; i++) {
    try { const r = await fetch(base + '/health'); healthy = r.ok; if (healthy) break; } catch {}
    await new Promise(r => setTimeout(r, 30));
  }
  assert.ok(healthy, output);
  const page = await fetch(base); assert.equal(page.status, 200);
  assert.match(page.headers.get('content-security-policy'), /frame-ancestors 'none'/);
  assert.equal(page.headers.get('x-content-type-options'), 'nosniff');
  for (const path of ['/server/security.js', '/.env', '/tools/browser-check.mjs', '/render.yaml']) {
    assert.equal((await fetch(base + path)).status, 404);
  }
  const ws = new WebSocket(`ws://127.0.0.1:${port}/socket`, { origin: 'https://racer.example' });
  await new Promise((resolve, reject) => { ws.once('open', resolve); ws.once('error', reject); });
  const welcome = new Promise(resolve => ws.once('message', raw => resolve(JSON.parse(raw))));
  ws.send(JSON.stringify({ type: 'hello', nickname: 'Production', version: 1 }));
  assert.equal((await welcome).nickname, 'Production'); ws.terminate();
  child.kill(); await exit;
  await assert.rejects(fetch(base + '/health'));
});
