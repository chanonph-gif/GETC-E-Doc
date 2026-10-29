import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

export const root = fileURLToPath(new URL('../prototype/', import.meta.url));
const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.woff': 'font/woff', '.txt': 'text/plain; charset=utf-8', '.svg': 'image/svg+xml' };

export function createServer() {
  return http.createServer(async (req, res) => {
    if (!['GET', 'HEAD'].includes(req.method)) { res.writeHead(405, { Allow: 'GET, HEAD' }).end(); return; }
    let name;
    try { name = decodeURIComponent(new URL(req.url, 'http://localhost').pathname); }
    catch { res.writeHead(400).end('Invalid path'); return; }
    if (name === '/') name = '/index.html';
    const relative = name.replace(/^\/+/, '');
    const target = path.resolve(root, relative);
    if (!target.startsWith(root) || relative.split('/').some(p => p.startsWith('.')) || relative.endsWith('.test.mjs') || !types[path.extname(target)]) {
      res.writeHead(404).end('Not found'); return;
    }
    try {
      const content = await readFile(target);
      res.writeHead(200, {
        'Content-Type': types[path.extname(target)],
        'Cache-Control': 'no-store',
        'X-Content-Type-Options': 'nosniff',
        'Referrer-Policy': 'no-referrer',
        'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self'; font-src 'self'; img-src 'self' blob: data:; frame-src 'self' blob:; object-src 'none'; base-uri 'none'; form-action 'self'",
      });
      res.end(req.method === 'HEAD' ? undefined : content);
    } catch { res.writeHead(404).end('Not found'); }
  });
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const portIndex=process.argv.indexOf('--port');
  const port = Number(portIndex>=0?process.argv[portIndex+1]:(process.env.PORT || 3000));
  if(!Number.isInteger(port)||port<1||port>65535)throw new Error('Invalid port');
  const server = createServer();
  server.listen(port, '0.0.0.0', () => console.log(`GETC E-Doc prototype: http://localhost:${port}`));
  for (const signal of ['SIGTERM', 'SIGINT']) process.on(signal, () => server.close(() => process.exit(0)));
}
