export interface SessionClaims {
  iat: number;
  exp: number;
  nonce: string;
  ipHash: string;
}

function b64urlEncode(bytes: Uint8Array): string {
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function b64urlDecode(str: string): Uint8Array {
  const pad = str.length % 4 === 0 ? '' : '='.repeat(4 - (str.length % 4));
  const s = atob(str.replace(/-/g, '+').replace(/_/g, '/') + pad);
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
}

async function hmac(secret: string, data: string): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(data));
  return new Uint8Array(sig);
}

function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

// Canonical JSON: fixed key order so the signed bytes are deterministic.
function canonical(c: SessionClaims): string {
  return JSON.stringify({ iat: c.iat, exp: c.exp, nonce: c.nonce, ipHash: c.ipHash });
}

export async function signToken(claims: SessionClaims, secret: string): Promise<string> {
  const payload = b64urlEncode(new TextEncoder().encode(canonical(claims)));
  const sig = b64urlEncode(await hmac(secret, payload));
  return `${payload}.${sig}`;
}

export async function verifyToken(
  token: string,
  secret: string,
  reqIpHash: string,
): Promise<{ ok: true; claims: SessionClaims } | { ok: false; reason: string }> {
  const parts = token.split('.');
  if (parts.length !== 2) return { ok: false, reason: 'malformed' };
  const [payload, sig] = parts;
  let expected: Uint8Array;
  let given: Uint8Array;
  try {
    expected = await hmac(secret, payload);
    given = b64urlDecode(sig);
  } catch {
    return { ok: false, reason: 'malformed' };
  }
  if (!timingSafeEqual(expected, given)) return { ok: false, reason: 'signature' };
  let claims: SessionClaims;
  try {
    claims = JSON.parse(new TextDecoder().decode(b64urlDecode(payload)));
  } catch {
    return { ok: false, reason: 'malformed' };
  }
  if (typeof claims.exp !== 'number' || typeof claims.ipHash !== 'string') {
    return { ok: false, reason: 'malformed' };
  }
  const now = Math.floor(Date.now() / 1000);
  if (claims.exp <= now) return { ok: false, reason: 'expired' };
  if (claims.ipHash !== reqIpHash) return { ok: false, reason: 'ip-mismatch' };
  return { ok: true, claims };
}
