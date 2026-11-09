// Development static preview only. No game server, external services or storage.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve, sep, extname } from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml' };
const host = process.env.HOST || '127.0.0.1';
const port = Number(process.env.PORT || 8081);
createServer(async (req, res) => {
  try {
    const path = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    const relative = path === '/' ? 'index.html' : path.slice(1);
    if (relative.split('/').some(p => p.startsWith('.')) || !/^(index\.html|game\.css|LICENSE|js\/[^?]+)$/.test(relative)) {
      res.writeHead(404).end(); return;
    }
    const file = resolve(root, relative);
    if (!file.startsWith(resolve(root) + sep)) { res.writeHead(403).end(); return; }
    const data = await readFile(file);
    res.writeHead(200, { 'Content-Type': `${types[extname(file)] || 'text/plain'}; charset=utf-8`, 'Cache-Control': 'no-store' });
    res.end(data);
  } catch { if (!res.headersSent) res.writeHead(404); res.end(); }
}).listen(port, host, () => console.log(`GenerateRacer preview: http://${host}:${port}`));
