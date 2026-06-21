import type { APIContext } from 'astro';
import { env } from 'cloudflare:workers';
import { requireSecret, verifyTurnstileToken, mintSession } from '../../server/turnstile';

export const prerender = false;

function json(data: unknown, status: number): Response {
  return new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json' } });
}

function clientIp(req: Request): string {
  return req.headers.get('cf-connecting-ip') || req.headers.get('x-real-ip') || '0.0.0.0';
}

async function alreadySeen(kv: KVNamespace, token: string): Promise<boolean> {
  const key = `ts:dup:${token}`;
  const hit = await kv.get(key);
  if (hit) return true;
  await kv.put(key, '1', { expirationTtl: 600 }); // Turnstile tokens expire ~5min; 10min set is safe
  return false;
}

async function mintRateLimited(kv: KVNamespace, ip: string, limit: number): Promise<boolean> {
  const bucket = Math.floor(Date.now() / 60000);
  const key = `ts:mint:${ip}:${bucket}`;
  const raw = await kv.get(key);
  const n = raw ? Number(raw) : 0;
  if (n >= limit) return true;
  await kv.put(key, String(n + 1), { expirationTtl: 120 });
  return false;
}

export async function POST(ctx: APIContext): Promise<Response> {
  const e = env as Record<string, unknown>;
  // Missing prod secrets are a deploy misconfig, not a client error: return a
  // clean, diagnosable 503 instead of an opaque unhandled 500.
  let hmacSecret: string;
  let tsSecret: string;
  try {
    hmacSecret = requireSecret('SESSION_HMAC_SECRET', e.SESSION_HMAC_SECRET as string | undefined);
    tsSecret = requireSecret('TURNSTILE_SECRET_KEY', e.TURNSTILE_SECRET_KEY as string | undefined);
  } catch {
    return json({ error: 'server-misconfig' }, 503);
  }
  const kv = e.BUDGETS as KVNamespace;
  const ttl = Number((e.SESSION_TOKEN_TTL_SECONDS as string) ?? '2700');
  const mintLimit = Number((e.MINT_RATE_PER_IP_PER_MIN as string) ?? '10');

  let body: { token?: string };
  try {
    body = await ctx.request.json();
  } catch {
    return json({ error: 'bad-json' }, 400);
  }
  const token = body.token;
  if (!token || typeof token !== 'string') return json({ error: 'missing-token' }, 400);

  const ip = clientIp(ctx.request);
  if (await mintRateLimited(kv, ip, mintLimit)) return json({ error: 'rate-limited' }, 429);
  if (await alreadySeen(kv, token)) return json({ error: 'duplicate-token' }, 400);

  const verified = await verifyTurnstileToken(token, tsSecret, ip);
  if (!verified.ok) return json({ error: 'turnstile-failed' }, 400);

  const sessionToken = await mintSession(ip, hmacSecret, ttl);
  return json({ sessionToken }, 200);
}
