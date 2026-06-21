import { signToken } from './token';
import { clientIpHash } from './ip';

export function requireSecret(name: string, value: string | undefined): string {
  if (!value || value.length === 0) throw new Error(`Required secret ${name} is not set`);
  return value;
}

export async function verifyTurnstileToken(
  token: string,
  secret: string,
  remoteip: string,
): Promise<{ ok: true } | { ok: false; reason: string }> {
  const form = new FormData();
  form.set('secret', secret);
  form.set('response', token);
  form.set('remoteip', remoteip);
  let res: Response;
  try {
    res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', { method: 'POST', body: form });
  } catch {
    return { ok: false, reason: 'siteverify-network' };
  }
  if (res.status !== 200) return { ok: false, reason: 'siteverify-status' };
  let body: { success?: boolean };
  try {
    body = await res.json();
  } catch {
    return { ok: false, reason: 'siteverify-parse' };
  }
  return body.success ? { ok: true } : { ok: false, reason: 'siteverify-rejected' };
}

export async function mintSession(remoteip: string, hmacSecret: string, ttlSeconds: number): Promise<string> {
  const iat = Math.floor(Date.now() / 1000);
  const nonce = crypto.randomUUID();
  const ipHash = await clientIpHash(remoteip);
  return signToken({ iat, exp: iat + ttlSeconds, nonce, ipHash }, hmacSecret);
}
