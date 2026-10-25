import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { createServer } from 'node:http';
import { once } from 'node:events';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { enforceHttps } from '../server/enforceHttps.js';
import { loadTlsOptions, createHttpRedirectHandler } from '../server/tls.js';

const app = express();
app.set('trust proxy', 1);
app.use(express.json());
app.use(enforceHttps);
app.get('/api/ping', (_req, res) => res.json({ ok: true }));
app.post('/api/ping', (_req, res) => res.json({ ok: true }));

let server;
let baseUrl;

before(async () => {
  server = createServer(app);
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  delete process.env.ENFORCE_HTTPS;
  await new Promise((resolve) => server.close(resolve));
});

function call(pathname, { method = 'GET', headers = {} } = {}) {
  return fetch(`${baseUrl}${pathname}`, { method, headers, redirect: 'manual' });
}

test('enforcement is off by default so local development is unchanged', async () => {
  delete process.env.ENFORCE_HTTPS;
  const res = await call('/api/ping');
  assert.equal(res.status, 200);
});

test('HTTP GET is redirected to HTTPS when enforcement is on', async () => {
  process.env.ENFORCE_HTTPS = 'true';
  const res = await call('/api/ping?x=1');
  assert.equal(res.status, 301);
  assert.equal(
    res.headers.get('location'),
    `https://${new URL(baseUrl).host}/api/ping?x=1`
  );
});

test('HTTP POST is rejected, not redirected, when enforcement is on', async () => {
  process.env.ENFORCE_HTTPS = 'true';
  const res = await call('/api/ping', { method: 'POST' });
  assert.equal(res.status, 403);
});

test('requests the proxy marked as HTTPS are allowed through', async () => {
  process.env.ENFORCE_HTTPS = 'true';
  const res = await call('/api/ping', { headers: { 'x-forwarded-proto': 'https' } });
  assert.equal(res.status, 200);
});

test('a malicious Host header is not used for the redirect target', async () => {
  process.env.ENFORCE_HTTPS = 'true';
  const res = await new Promise((resolve) => {
    import('node:http').then(({ request }) => {
      const req = request(
        { host: '127.0.0.1', port: server.address().port, path: '/api/ping',
          headers: { host: 'evil.com/@attacker.com' } },
        resolve
      );
      req.end();
    });
  });
  assert.equal(res.statusCode, 400);
  res.resume();
});

test('HTTPS stays off unless ENABLE_HTTPS=true', () => {
  assert.equal(loadTlsOptions({}), null);
  assert.equal(loadTlsOptions({ ENABLE_HTTPS: 'false' }), null);
});

test('HTTPS enabled without certificate files fails with a helpful message', () => {
  assert.throws(
    () => loadTlsOptions({
      ENABLE_HTTPS: 'true',
      TLS_KEY_PATH: path.join(os.tmpdir(), 'missing-key.pem'),
      TLS_CERT_PATH: path.join(os.tmpdir(), 'missing-cert.pem'),
    }),
    /npm run cert/
  );
});

test('certificate files are loaded from the configured paths', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'oipp-tls-'));
  fs.writeFileSync(path.join(dir, 'k.pem'), 'KEY');
  fs.writeFileSync(path.join(dir, 'c.pem'), 'CERT');

  const options = loadTlsOptions({
    ENABLE_HTTPS: 'true',
    TLS_KEY_PATH: path.join(dir, 'k.pem'),
    TLS_CERT_PATH: path.join(dir, 'c.pem'),
  });

  assert.equal(options.key.toString(), 'KEY');
  assert.equal(options.cert.toString(), 'CERT');
  fs.rmSync(dir, { recursive: true, force: true });
});

test('the plain-HTTP port only redirects to the HTTPS port', () => {
  const handler = createHttpRedirectHandler(4443);
  let head;
  const res = {
    writeHead: (status, headers) => { head = { status, headers }; },
    end: () => {},
  };
  handler({ headers: { host: 'localhost:4000' }, url: '/api/health' }, res);
  assert.equal(head.status, 301);
  assert.equal(head.headers.Location, 'https://localhost:4443/api/health');
});
