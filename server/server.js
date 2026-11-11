import { fault, MessageError } from '../shared/translations.js';
import { createServer } from 'node:http';
import { WebSocketServer } from 'ws';
import { pathToFileURL } from 'node:url';
import { networkInterfaces } from 'node:os';
import { connect } from 'node:net';
import { Game } from './game.js';
import { staticRequest } from './static.js';
import { SIMULATION_STEP } from '../js/constants.js';
import { configuredOrigin, allowedOrigin, connectionBudget } from './security.js';

export async function createGameServer({ host = '127.0.0.1', port = 0, countdownMs = 3000, autoTick = true,
  publicOrigin = process.env.PUBLIC_ORIGIN || process.env.RENDER_EXTERNAL_URL,
  production = process.env.NODE_ENV === 'production' } = {}) {
  const expectedOrigin = configuredOrigin(publicOrigin, production), admitConnection = connectionBudget();
  const game = new Game({ countdownMs });
  const http = createServer(staticRequest);
  http.requestTimeout = 15000; http.headersTimeout = 10000; http.maxHeadersCount = 50;
  const wss = new WebSocketServer({ noServer: true, maxPayload: 4096, perMessageDeflate: false });
  http.on('upgrade', (req, socket, head) => {
    try {
      const origin = req.headers.origin;
      if (req.url !== '/socket' || wss.clients.size >= 128 || !allowedOrigin(origin, req.headers.host, expectedOrigin, production)) {
        socket.end('HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n'); return;
      }
      if (!admitConnection()) { socket.end('HTTP/1.1 429 Too Many Requests\r\nConnection: close\r\n\r\n'); return; }
      wss.handleUpgrade(req, socket, head, ws => wss.emit('connection', ws));
    } catch { socket.destroy(); }
  });
  wss.on('connection', ws => {
    // A proxy may deliver a few seconds of the legitimate 60 Hz stream together.
    // Bound that burst separately from the unchanged 75/sec sustained budget;
    // expensive lobby commands still have their stricter 12-burst / 4-per-second limit.
    ws.alive = true; ws.tokens = 240; ws.tokenAt = performance.now(); ws.commands = 12; ws.commandAt = performance.now();
    const timeout = setTimeout(() => { if (!ws.session) ws.close(1008, 'error.nicknameFirst'); }, 5000);
    ws.on('pong', () => { ws.alive = true; });
    ws.on('error', () => {});
    ws.on('close', () => { clearTimeout(timeout); game.disconnect(ws); });
    ws.on('message', (raw, binary) => {
      let requestId;
      try {
        const now = performance.now();
        ws.tokens = Math.min(240, ws.tokens + (now - ws.tokenAt) * 0.075); ws.tokenAt = now;
        if (--ws.tokens < 0) { ws.close(1008, 'error.tooManyMessages'); return; }
        if (binary) throw fault('error.jsonOnly');
        const m = JSON.parse(raw.toString());
        if (!m || typeof m !== 'object' || Array.isArray(m) || typeof m.type !== 'string') throw fault('error.message');
        requestId = typeof m.requestId === 'string' ? m.requestId.slice(0, 64) : undefined;
        if (m.type !== 'input') {
          ws.commands = Math.min(12, ws.commands + (now - ws.commandAt) * 0.004); ws.commandAt = now;
          if (--ws.commands < 0) throw fault('error.slowDown');
        }
        if (m.type === 'hello' && !ws.session) { game.hello(ws, m); clearTimeout(timeout); return; }
        const s = ws.session;
        if (!s) throw fault('error.nicknameFirst');
        if (m.type === 'create') game.create(s, m);
        else if (m.type === 'solo') game.solo(s, m.raceId);
        else if (m.type === 'join') game.join(s, m.code);
        else if (m.type === 'list') game.list(ws);
        else if (m.type === 'start') game.start(s, m.lobbyId);
        else if (m.type === 'ready') game.ready(s, m.ready, m.lobbyId);
        else if (m.type === 'cancel') game.cancel(s, m.lobbyId);
        else if (m.type === 'input') game.input(s, m);
        else if (m.type === 'leave') {
          if (m.roomCode !== s.roomId) throw fault('error.roomChanged');
          game.leave(s);
        }
        else if (m.type === 'back') game.back(s, m.raceId);
        else throw fault('error.unknownAction');
        if (m.type !== 'input') game.send(ws, { type: 'ack', requestId });
      } catch (e) {
        const error = e instanceof SyntaxError ? fault('error.json') : e instanceof MessageError ? e : fault('error.unknown');
        game.send(ws, { type: 'error', requestId, code: error.code, params: error.params, message: error.message });
      }
    });
  });
  let accumulator = 0, previous = performance.now();
  const timers = [];
  if (autoTick) timers.push(setInterval(() => {
    const now = performance.now(); accumulator += Math.min((now - previous) / 1000, 0.25); previous = now;
    while (accumulator >= SIMULATION_STEP) { game.step(); accumulator -= SIMULATION_STEP; }
  }, 8));
  timers.push(setInterval(() => game.broadcastSnapshots(), 50));
  timers.push(setInterval(() => {
    game.sweep();
    for (const ws of wss.clients) { if (!ws.alive) ws.terminate(); else { ws.alive = false; ws.ping(); } }
  }, 10000));
  await new Promise((resolve, reject) => { http.once('error', reject); http.listen(port, host, resolve); });
  return { http, wss, game, port: http.address().port,
    async close() { timers.forEach(clearInterval); for (const ws of wss.clients) ws.terminate();
      await new Promise(resolve => wss.close(resolve)); await new Promise(resolve => http.close(resolve)); } };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const host = process.env.HOST || '0.0.0.0', port = Number(process.env.PORT || 8081);
  if (!Number.isInteger(port) || port < 1 || port > 65535) { console.error('PORT must be an integer from 1 to 65535.'); process.exit(1); }
  // Windows can allow a wildcard listener alongside an older loopback-only preview.
  // Detect it rather than serving different applications at the LAN and local URLs.
  const occupied = await new Promise(resolve => {
    const probe = connect({ host: host === '0.0.0.0' ? '127.0.0.1' : host, port });
    const done = result => { probe.destroy(); resolve(result); };
    probe.once('connect', () => done(true)); probe.once('error', () => done(false)); probe.setTimeout(300, () => done(false));
  });
  if (occupied) { console.error(`Port ${port} is in use. Stop the previous preview or select another PORT.`); process.exit(1); }
  try {
    const server = await createGameServer({ host, port });
    console.log(`GenerateRacer: http://127.0.0.1:${port}/`);
    if (host === '0.0.0.0') for (const addresses of Object.values(networkInterfaces())) for (const a of addresses || []) {
      if (a.family === 'IPv4' && !a.internal) console.log(`Local network: http://${a.address}:${port}/`);
    }
    for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => server.close().then(() => process.exit(0)));
  } catch (e) { console.error(e.code === 'EADDRINUSE' ? `Port ${port} is in use. Stop the previous preview or select another PORT.` : e.message); process.exit(1); }
}
