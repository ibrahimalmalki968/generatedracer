import WebSocket from 'ws';
export async function client(port, nickname = 'Racer', token) {
  const remote = typeof port === 'string' && /^https?:/.test(port) ? new URL('/socket', port) : null;
  const origin = remote?.origin;
  if (remote) remote.protocol = remote.protocol === 'https:' ? 'wss:' : 'ws:';
  const ws = new WebSocket(remote || `ws://127.0.0.1:${port}/socket`, { origin, handshakeTimeout: 20000 });
  const messages = [];
  let latestRoom, latestSnapshot;
  ws.on('message', raw => {
    const message = JSON.parse(raw); messages.push(message);
    if (message.type === 'room') latestRoom = message.room;
    if (message.type === 'snapshot') latestSnapshot = message;
    if (messages.length > 500) messages.splice(0, 100);
  });
  ws.on('error', () => {});
  const until = async (predicate, timeout = remote ? 20000 : 3000) => {
    const deadline = Date.now() + timeout;
    while (Date.now() < deadline) {
      const m = [...messages].reverse().find(predicate); if (m) return m;
      if (ws.readyState === WebSocket.CLOSED) throw new Error(`Socket closed: ${ws._closeCode} ${ws._closeMessage?.toString()}`);
      await new Promise(r => setTimeout(r, 5));
    }
    throw new Error(`Socket timeout: ${messages.slice(-3).map(m => m.type + (m.message || '')).join(',')}`);
  };
  await new Promise((resolve, reject) => { ws.once('open', resolve); ws.once('error', reject); });
  ws.send(JSON.stringify({ type: 'hello', version: 1, nickname, token }));
  const welcome = await until(m => m.type === 'welcome');
  let request = 0;
  return { ws, messages, welcome, until,
    send(message) { ws.send(JSON.stringify(message)); },
    async request(message) {
      const room = latestRoom;
      const requestId = String(++request); ws.send(JSON.stringify({
        ...(['ready', 'start', 'cancel'].includes(message.type) ? { lobbyId: room?.lobbyId } : {}),
        ...(message.type === 'leave' ? { roomCode: room?.code } : {}),
        ...message, requestId,
      }));
      return until(m => m.requestId === requestId && ['ack', 'error'].includes(m.type));
    },
    room() { return latestRoom; },
    snapshot() { return latestSnapshot; },
  };
}
