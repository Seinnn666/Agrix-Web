// Local-only, read-only HTTP fixtures for reproducible dashboard Lighthouse audits.
// No production accounts, Supabase credentials, or deployed services are used.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const host = '127.0.0.1';
const port = 4180;
const dist = path.resolve('dist');
const now = Date.now();

const readings = [
  { id: 'fixture-1', deviceId: 'qa-sensor', temperature: 38.2, humidity: 56.3, soilMoisture: 42.1, createdAt: now - 120000 },
  { id: 'fixture-2', deviceId: 'qa-sensor', temperature: 38.5, humidity: 55.8, soilMoisture: 41.9, createdAt: now - 60000 },
];
const fixtures = new Map([
  ['/api/health', { status: 'ok', mode: 'synthetic-fixture' }],
  ['/api/admin/metrics', {
    metrics: { totalUsers: 34, totalAdmins: 2, emailVerified: 27, phoneVerified: 18 },
    recentUsers: [
      { id: 'qa-1', fullName: 'Sample Grower', email: 'grower@example.test', role: 'user', isAdmin: false, emailVerified: true, createdAt: new Date(now - 86400000).toISOString() },
      { id: 'qa-2', fullName: 'Sample Farmer', email: 'farmer@example.test', role: 'user', isAdmin: false, emailVerified: true, createdAt: new Date(now - 172800000).toISOString() },
    ],
  }],
  ['/api/sensors/history', { readings }],
  ['/api/sensors/latest', { reading: readings.at(-1) }],
]);
const mimeTypes = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
};

http.createServer((req, res) => {
  const url = new URL(req.url || '/', `http://${host}:${port}`);
  if (url.pathname.startsWith('/api/')) {
    const body = fixtures.get(url.pathname);
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Agrix-QA-Mode', 'synthetic-local-fixtures');
    res.writeHead(req.method !== 'GET' ? 405 : body ? 200 : 404);
    res.end(JSON.stringify(req.method !== 'GET' ? { error: 'Fixture server is read-only' } : body || { error: 'No fixture for requested endpoint' }));
    return;
  }
  const decoded = decodeURIComponent(url.pathname);
  const file = path.resolve(dist, `.${decoded === '/' ? '/index.html' : decoded}`);
  if (!file.startsWith(`${dist}${path.sep}`)) {
    res.writeHead(403).end();
    return;
  }
  fs.stat(file, (error, stat) => {
    const serving = error || !stat.isFile() ? path.join(dist, 'index.html') : file;
    fs.readFile(serving, (readError, body) => {
      if (readError) {
        res.writeHead(404).end('Not found');
        return;
      }
      res.setHeader('Content-Type', mimeTypes[path.extname(serving)] || 'application/octet-stream');
      res.setHeader('Cache-Control', 'no-store');
      res.writeHead(200).end(body);
    });
  });
}).listen(port, host, () => {
  console.log(`AgriX synthetic fixture server at http://${host}:${port}/ (no external services)`);
});
