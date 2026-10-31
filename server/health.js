import { Router } from 'express';

// NF-002: readiness check used by the smoke check and the uptime monitor.
// /api/health (in index.js) only proves the process is up. This one also proves the
// database answers, because most features are unusable without it.
// Failures return a generic body: no error text, hostnames or credentials.

export function createHealthRouter(dbPool, { timeoutMs = 2000 } = {}) {
  const router = Router();

  router.get('/health/ready', async (_req, res) => {
    let timer;
    try {
      await Promise.race([
        dbPool.query('SELECT 1'),
        new Promise((_resolve, reject) => {
          timer = setTimeout(() => reject(new Error('database timeout')), timeoutMs);
        }),
      ]);
      return res.json({
        status: 'ok',
        database: 'up',
        uptimeSeconds: Math.round(process.uptime()),
      });
    } catch {
      return res.status(503).json({ status: 'degraded', database: 'down' });
    } finally {
      clearTimeout(timer);
    }
  });

  return router;
}
