// Creates a self-signed certificate for LOCAL development only.
// Run once with:  npm run cert
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import selfsigned from 'selfsigned';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dir = path.join(root, 'certs');
fs.mkdirSync(dir, { recursive: true });

const pems = await selfsigned.generate(
  [{ name: 'commonName', value: 'localhost' }],
  { days: 365, keySize: 2048, algorithm: 'sha256' }
);

fs.writeFileSync(path.join(dir, 'dev-key.pem'), pems.private);
fs.writeFileSync(path.join(dir, 'dev-cert.pem'), pems.cert);
console.log('Created certs/dev-key.pem and certs/dev-cert.pem (valid 365 days).');
