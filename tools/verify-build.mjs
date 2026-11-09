import assert from 'node:assert/strict';
import { createGameServer } from '../dist/server/server.js';
import WebSocket from 'ws';
const s = await createGameServer({ countdownMs: 0 });
try {
  const base = `http://127.0.0.1:${s.port}`;
  assert.equal((await fetch(`${base}/health`)).status, 200);
  assert.match(await (await fetch(base)).text(), /Your nickname/);
  assert.match(await (await fetch(`${base}/LICENSE`)).text(), /Jeroen Willemsen/);
  const ws = new WebSocket(`ws://127.0.0.1:${s.port}/socket`);
  const snapshot = new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Build socket smoke timed out')), 5000);
    ws.on('error', reject);
    ws.on('open', () => ws.send(JSON.stringify({ type: 'hello', version: 1, nickname: 'Build smoke' })));
    ws.on('message', data => {
      const m = JSON.parse(data);
      if (m.type === 'welcome') ws.send('{"type":"create","name":"Build smoke","private":true}');
      if (m.type === 'room' && m.room.phase === 'lobby') ws.send(JSON.stringify({ type: 'start', lobbyId: m.room.lobbyId }));
      if (m.type === 'snapshot') { clearTimeout(timeout); resolve(m); }
    });
  });
  const state = await snapshot;
  assert.equal(state.cars.length, 6); assert.equal(state.cars.filter(c => !c.isHuman).length, 5);
  ws.terminate(); console.log('Production build smoke passed: HTTP, attribution, WebSocket identity, room, solo start and six-car authoritative state.');
} finally { await s.close(); }
