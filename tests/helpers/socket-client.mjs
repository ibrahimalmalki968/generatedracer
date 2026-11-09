import WebSocket from 'ws';
export async function client(port, nickname = 'Racer', token) {
  const ws = new WebSocket(`ws://127.0.0.1:${port}/socket`);
  const messages = [];
  ws.on('message', raw => { messages.push(JSON.parse(raw)); if (messages.length > 500) messages.splice(0, 100); });
  ws.on('error', () => {});
  const until = async (predicate, timeout = 3000) => {
    const deadline = Date.now() + timeout;
    while (Date.now() < deadline) { const m = [...messages].reverse().find(predicate); if (m) return m; await new Promise(r => setTimeout(r, 5)); }
    throw new Error(`Socket timeout: ${messages.slice(-3).map(m => m.type + (m.message || '')).join(',')}`);
  };
  await new Promise((resolve, reject) => { ws.once('open', resolve); ws.once('error', reject); });
  ws.send(JSON.stringify({ type: 'hello', version: 1, nickname, token }));
  const welcome = await until(m => m.type === 'welcome');
  let request = 0;
  return { ws, messages, welcome, until,
    send(message) { ws.send(JSON.stringify(message)); },
    async request(message) {
      const room = [...messages].reverse().find(m => m.type === 'room')?.room;
      const requestId = String(++request); ws.send(JSON.stringify({
        ...(['ready', 'start', 'cancel'].includes(message.type) ? { lobbyId: room?.lobbyId } : {}),
        ...(message.type === 'leave' ? { roomCode: room?.code } : {}),
        ...message, requestId,
      }));
      return until(m => m.requestId === requestId && ['ack', 'error'].includes(m.type));
    },
    room() { return [...messages].reverse().find(m => m.type === 'room')?.room; },
    snapshot() { return [...messages].reverse().find(m => m.type === 'snapshot'); },
  };
}
