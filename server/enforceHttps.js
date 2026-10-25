// OIPP-SR-001: make sure protected functionality is never used over plain HTTP.
// Off by default so local development is unchanged. Set ENFORCE_HTTPS=true when deployed.
// Behind a hosting proxy (Render, Railway, Nginx...) the proxy sets X-Forwarded-Proto,
// which Express exposes as req.secure when "trust proxy" is enabled in server/index.js.

const SAFE_HOST = /^[a-z0-9.-]+(:\d{1,5})?$/i;

export function enforceHttps(req, res, next) {
  if (process.env.ENFORCE_HTTPS !== 'true') return next();
  if (req.secure) return next();

  // Never redirect a POST/PUT/etc: credentials in the body must not be re-sent over HTTP.
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    return res.status(403).json({ message: 'HTTPS is required.' });
  }

  const host = req.headers.host || '';
  if (!SAFE_HOST.test(host)) {
    return res.status(400).json({ message: 'Invalid host header.' });
  }

  return res.redirect(301, `https://${host}${req.originalUrl}`);
}
