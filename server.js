/* ==============================================================
   server.js — tiny dependency-free static file server
   for hosting the Guwahati Flood Reporting System locally.

   Usage:   node server.js
   Then open: http://localhost:5500

   Optional custom port:  PORT=8080 node server.js
   ============================================================== */
'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname);
const PORT = Number(process.env.PORT) || 5500;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2'
};

const server = http.createServer((req, res) => {
  try {
    let pathname = decodeURIComponent(req.url.split('?')[0]);
    if (pathname === '/') pathname = '/index.html';

    /* Resolve and guard against path traversal */
    const filePath = path.normalize(path.join(ROOT, pathname));
    const rootLc = ROOT.toLowerCase();
    const fileLc = filePath.toLowerCase();
    if (fileLc !== rootLc && !fileLc.startsWith(rootLc + path.sep)) {
      res.writeHead(403, { 'Content-Type': 'text/plain' });
      return res.end('Forbidden');
    }

    fs.stat(filePath, (err, stat) => {
      if (err || !stat.isFile()) {
        res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
        return res.end(
          '<!DOCTYPE html><meta charset="utf-8"><title>404</title>' +
          '<h1>404 — not found</h1>' +
          '<p><a href="/">Back to Guwahati Flood Reporting System</a></p>'
        );
      }
      const ext = path.extname(filePath).toLowerCase();
      res.writeHead(200, {
        'Content-Type': MIME[ext] || 'application/octet-stream',
        'Cache-Control': 'no-cache'
      });
      fs.createReadStream(filePath).pipe(res);
    });

    console.log(req.method + ' ' + req.url);
  } catch (e) {
    res.writeHead(500, { 'Content-Type': 'text/plain' });
    res.end('Server error');
    console.error(e);
  }
});

server.on('error', (e) => {
  if (e.code === 'EADDRINUSE') {
    console.error('Port ' + PORT + ' is already in use. Try:  PORT=5501 node server.js');
  } else {
    console.error(e.message);
  }
  process.exit(1);
});

server.listen(PORT, () => {
  console.log('──────────────────────────────────────────────');
  console.log('  Guwahati Flood Reporting System');
  console.log('  Local server running → http://localhost:' + PORT);
  console.log('  Press Ctrl+C to stop.');
  console.log('──────────────────────────────────────────────');
});
