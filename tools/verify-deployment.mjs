// Black-box verification using public HTTP/WSS only; no trusted lap fixtures.
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { client } from '../tests/helpers/socket-client.mjs';
import { Car } from '../js/car.js';
import { AiController } from '../js/ai.js';
import { Network } from '../js/network.js';

if (!process.env.BASE_URL) throw new Error('Set BASE_URL to the deployed HTTPS game URL.');
const base = new URL(process.env.BASE_URL);
if (!['http:', 'https:'].includes(base.protocol) || base.username || base.password) throw new Error('Use an HTTP(S) URL without credentials.');
const evidence = resolve(process.env.EVIDENCE_DIR || 'work/deployment');
await mkdir(evidence, { recursive: true });
const report = { baseUrl: base.origin, checkedAt: new Date().toISOString(), checks: [], rooms: [], errors: [] };
const check = (value, label) => { assert.ok(value, label); report.checks.push(label); };
const clients = [], groups = [], networks = new Map(); let timer, progress;

async function customer(name) {
  const c = await client(base.origin, name); clients.push(c);
  const net = new Network(); net.ready = true; net.playerId = c.welcome.playerId; net.socket = c.ws;
  c.ws.on('message', raw => {
    const m = JSON.parse(raw);
    if (m.type === 'room') { const previous = net.room?.raceId; net.room = m.room; if (previous !== m.room.raceId) net.resetRace(); }
    else if (m.type === 'snapshot') net.apply(m);
  });
  networks.set(c, net); return c;
}
async function group(n) {
  const players = []; for (let i = 0; i < n; i++) players.push(await customer(`Verify${n}-${i}`));
  assert.equal((await players[0].request({ type: 'create', name: `Verification ${n}`, private: n !== 2 })).type, 'ack');
  const code = players[0].room().code;
  for (const c of players.slice(1)) assert.equal((await c.request({ type: 'join', code })).type, 'ack');
  await Promise.all(players.map(c => c.until(m => m.type === 'room' && m.room.code === code && m.room.players.length === n)));
  const g = { n, clients: players, code }; groups.push(g);
  check(players[0].room().players.length === n, `${n} actual WebSocket humans join one room`); return g;
}
async function ready(g) {
  const previousRace = g.clients[0].room().raceId;
  for (const c of g.clients) assert.equal((await c.request({ type: 'ready', ready: true })).type, 'ack');
  const started = await Promise.all(g.clients.map(c => c.until(m => m.type === 'room' && m.room.phase === 'racing' && m.room.raceId !== previousRace)));
  const raceId = started[0].room.raceId;
  await Promise.all(g.clients.map(c => c.until(m => m.type === 'snapshot' && m.raceId === raceId)));
}
async function finish(g) {
  console.log(`Waiting for ${g.n}-human full physical race…`);
  const raceId = g.clients[0].room().raceId;
  const results = await Promise.all(g.clients.map(c => c.until(m => m.type === 'room' && m.room.phase === 'results' && m.room.raceId === raceId, 180000)));
  const reference = results[0].room.results;
  for (const r of results) assert.deepEqual(r.room.results, reference);
  check(reference.length === g.n && reference.every(r => r.lap === 3 && r.status === 'finished'), `${g.n} humans: three valid laps, no AI and identical final standings`);
  check(g.clients.every(c => c.snapshot().cars.every(car => car.turboUses >= 1 && car.turboUses <= 3)), `${g.n} humans: Turbo activates, maximum three uses`);
  report.rooms.push({ humans: g.n, raceId, results: reference });
  const previousLobby = g.clients[0].room().lobbyId;
  assert.equal((await g.clients[0].request({ type: 'back', raceId })).type, 'ack');
  await Promise.all(g.clients.map(c => c.until(m => m.type === 'room' && m.room.phase === 'lobby' && m.room.lobbyId !== previousLobby)));
  check(g.clients[0].room().code === g.code && g.clients[0].room().players.every(p => !p.ready), `${g.n} humans: same lobby, Ready reset, no automatic rematch`);
}
try {
  const health = await fetch(new URL('/health', base), { signal: AbortSignal.timeout(120000) });
  check(health.ok && (await health.json()).ok, 'Public health endpoint');
  const page = await fetch(base); check(page.ok && (await page.text()).includes('data-i18n="entry.nickname"'), 'Localized game HTML served');
  for (const path of ['/server/server.js', '/.env', '/.git/config', '/tools/browser-check.mjs', '/js/lib%5c..%5c..%5cserver%5cgame.js']) check((await fetch(new URL(path, base))).status === 404, `${path} not exposed`);
  const a = await group(2), b = await group(3), visitor = await customer('Verification visitor');
  await visitor.request({ type: 'list' });
  const listed = [...visitor.messages].reverse().find(m => m.type === 'rooms').rooms;
  check(listed.some(r => r.code === a.code) && !listed.some(r => r.code === b.code), 'Public discovery hides private rooms');
  await ready(a); await ready(b);
  check((await visitor.request({ type: 'join', code: a.code })).message.includes('Race in Progress'), 'Committed race admission locked');
  a.clients[0].send({ type: 'input', raceId: b.clients[0].room().raceId, seq: 1, boost: 1, gas: 1, brake: 0, steer: 0 });
  a.clients[0].send({ type: 'input', raceId: a.clients[0].room().raceId, seq: 2, boost: 1, gas: 1, brake: 0, steer: 0, carId: 1 });
  await a.clients[0].until(m => m.type === 'error' && m.message === 'Invalid control input.');
  check(b.clients[0].snapshot().cars.every(c => c.turboUses === 0), 'Cross-room and client-selected car inputs cannot spend Turbo');
  // Reuse actual client prediction/reconciliation, rather than steering from old snapshots.
  timer = setInterval(() => {
    for (const [c, net] of networks) {
      const car = net.predicted;
      if (c.ws.readyState !== 1 || net.room?.phase !== 'racing' || !car || car.finished || car.disconnected) continue;
      const ghost = new Car(car.id, car.x, car.y, car.angle, { isHuman: false });
      Object.assign(ghost, { speed: car.speed, lap: car.lap, turboAvailable: car.turboAvailable });
      new AiController(ghost).update(1 / 60); net.predict(ghost.input);
    }
  }, 17);
  progress = setInterval(() => console.log(groups.filter(g => g.clients[0].room()?.phase === 'racing').map(g => `${g.n}p: ${g.clients[0].snapshot()?.cars.map(c => `${c.lap}${c.finished ? 'F' : ''}@${Math.round(c.speed)}`).join(',')}`).join(' | ')), 15000);
  await Promise.all([finish(a), finish(b)]);
  check(true, 'Two concurrent public/private rooms finish independently');
  for (const c of b.clients) c.ws.close();
  // Bound public test bandwidth; 20 concurrent clients remain a local stress test.
  for (const n of [4, 5, 6]) {
    const g = await group(n);
    if (n === 6) check((await visitor.request({ type: 'join', code: g.code })).message.includes('full'), 'Seventh human rejected');
    await ready(g); await finish(g); for (const c of g.clients) c.ws.close();
  }
  const oldRace = report.rooms.find(g => g.humans === 2).raceId;
  await ready(a); const rematchId = a.clients[0].room().raceId; check(rematchId !== oldRace, 'Explicit same-room rematch receives fresh race identity');
  a.clients[1].ws.close();
  await a.clients[0].until(m => m.type === 'snapshot' && m.raceId === rematchId && m.cars.some(c => c.disconnected));
  const rematch = await a.clients[0].until(m => m.type === 'room' && m.room.phase === 'results' && m.room.raceId === rematchId, 180000);
  check(rematch.room.results.length === 2 && rematch.room.results.some(r => r.status === 'disconnected') && rematch.room.results.some(r => r.status === 'finished' && r.lap === 3), 'Opponent disconnect records DNF; remaining racer finishes without AI replacement');
  assert.equal((await a.clients[0].request({ type: 'back', raceId: rematchId })).type, 'ack');
  report.passed = report.checks.length;
} catch (e) {
  report.errors.push(e.stack); process.exitCode = 1;
  report.unfinished = groups.map(g => ({ humans: g.n, phase: g.clients[0].room()?.phase, cars: g.clients[0].snapshot()?.cars,
    sockets: g.clients.map(c => ({ state: c.ws.readyState, closeCode: c.ws._closeCode, reason: c.ws._closeMessage?.toString() })) }));
} finally {
  clearInterval(timer); clearInterval(progress); for (const c of clients) c.ws.close();
  await writeFile(resolve(evidence, 'sockets.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ baseUrl: report.baseUrl, passed: report.passed, errors: report.errors, evidence }, null, 2));
}
