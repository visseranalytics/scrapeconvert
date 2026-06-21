// Deploy guard: fail if required Worker secrets are not configured.
// Run before `wrangler deploy`. Checks `wrangler secret list` output.
import { execFileSync } from 'node:child_process';

const REQUIRED = ['SESSION_HMAC_SECRET', 'TURNSTILE_SECRET_KEY'];

// Fixed argument array, no shell: nothing is interpolated from user input.
let listed = '';
try {
  listed = execFileSync('npx', ['wrangler', 'secret', 'list'], { encoding: 'utf8' });
} catch (e) {
  console.error('Could not list Worker secrets:', e.message);
  process.exit(1);
}

const missing = REQUIRED.filter((name) => !listed.includes(name));
if (missing.length) {
  console.error('Missing required Worker secrets (deploy blocked):', missing.join(', '));
  console.error('Set them with: wrangler secret put <NAME>');
  process.exit(1);
}
console.log('All required secrets present:', REQUIRED.join(', '));
