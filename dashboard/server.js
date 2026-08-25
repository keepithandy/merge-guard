import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const directory = path.dirname(fileURLToPath(import.meta.url));
const assets = new Map([
  ['/', ['index.html', 'text/html; charset=utf-8']],
  ['/index.html', ['index.html', 'text/html; charset=utf-8']],
  ['/app.js', ['app.js', 'text/javascript; charset=utf-8']],
  ['/import-worker.js', ['import-worker.js', 'text/javascript; charset=utf-8']],
  ['/import-contract.js', ['import-contract.js', 'text/javascript; charset=utf-8']],
  ['/styles.css', ['styles.css', 'text/css; charset=utf-8']]
]);
export const CONTENT_SECURITY_POLICY = "default-src 'none'; connect-src 'none'; img-src 'self' data:; style-src 'self'; style-src-attr 'none'; script-src 'self'; script-src-attr 'none'; worker-src 'self'; font-src 'self'; object-src 'none'; base-uri 'none'; form-action 'none'; frame-src 'none'; frame-ancestors 'none'; manifest-src 'none'";

function headers(type) { return { 'Content-Type': type, 'Cache-Control': 'no-store', 'Content-Security-Policy': CONTENT_SECURITY_POLICY, 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer', 'Cross-Origin-Resource-Policy': 'same-origin' }; }
export function createDashboardServer() {
  const server = http.createServer((request, response) => {
    const authority = `127.0.0.1:${server.address()?.port}`;
    if (request.headers.host !== authority) { response.writeHead(421, headers('text/plain; charset=utf-8')); return response.end('Misdirected request'); }
    if (!['GET', 'HEAD'].includes(request.method)) { response.writeHead(405, { ...headers('text/plain; charset=utf-8'), Allow: 'GET, HEAD' }); return response.end(); }
    if (!request.url || request.url.includes('?') || request.url.includes('#')) { response.writeHead(404, headers('text/plain; charset=utf-8')); return response.end('Not found'); }
    const asset = assets.get(request.url);
    if (!asset) { response.writeHead(404, headers('text/plain; charset=utf-8')); return response.end('Not found'); }
    response.writeHead(200, headers(asset[1]));
    if (request.method === 'HEAD') return response.end();
    fs.createReadStream(path.join(directory, asset[0])).pipe(response);
  });
  return server;
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const server = createDashboardServer();
  server.listen(0, '127.0.0.1', () => console.log(`Merge Guard dashboard: http://127.0.0.1:${server.address().port}/`));
}
