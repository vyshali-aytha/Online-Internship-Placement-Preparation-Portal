import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const currentDirectory = path.dirname(fileURLToPath(import.meta.url));

/**
 * Returns { key, cert } when ENABLE_HTTPS=true, otherwise null (plain HTTP, the default).
 * Local dev: run "npm run cert" to create certs/dev-key.pem and certs/dev-cert.pem.
 * Real certificates: set TLS_KEY_PATH and TLS_CERT_PATH.
 */
export function loadTlsOptions(env = process.env) {
  if (env.ENABLE_HTTPS !== 'true') return null;

  const keyPath = env.TLS_KEY_PATH
    || path.resolve(currentDirectory, '../certs/dev-key.pem');
  const certPath = env.TLS_CERT_PATH
    || path.resolve(currentDirectory, '../certs/dev-cert.pem');

  if (!fs.existsSync(keyPath) || !fs.existsSync(certPath)) {
    throw new Error(
      'ENABLE_HTTPS=true but the certificate files were not found. '
      + 'Run "npm run cert" for a local development certificate.'
    );
  }

  return {
    key: fs.readFileSync(keyPath),
    cert: fs.readFileSync(certPath),
  };
}

/** Handler for the plain-HTTP port: it only redirects to HTTPS. */
export function createHttpRedirectHandler(httpsPort) {
  return (req, res) => {
    const host = String(req.headers.host || 'localhost').replace(/:\d+$/, '');

    if (!/^[a-z0-9.-]+$/i.test(host)) {
      res.writeHead(400);
      return res.end();
    }

    const portPart = Number(httpsPort) === 443 ? '' : `:${httpsPort}`;
    res.writeHead(301, { Location: `https://${host}${portPart}${req.url}` });
    return res.end();
  };
}
