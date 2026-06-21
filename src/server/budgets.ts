export interface RateLimitContext {
  kv: KVNamespace;
  rl?: { limit(opts: { key: string }): Promise<{ success: boolean }> };
}

// KV counters are eventually-consistent and best-effort. They bound a crawl/
// session; the WAF zone rules (hosted) are the hard ceiling.
async function incr(kv: KVNamespace, key: string, by: number, ttl: number): Promise<number> {
  const raw = await kv.get(key);
  const n = (raw ? Number(raw) : 0) + by;
  await kv.put(key, String(n), { expirationTtl: ttl });
  return n;
}

export async function checkBurst(ctx: RateLimitContext, tokenNonce: string): Promise<boolean> {
  if (!ctx.rl) return false;
  const r = await ctx.rl.limit({ key: tokenNonce });
  return !r.success;
}

export async function consumeFetchBudget(kv: KVNamespace, nonce: string, limit: number): Promise<boolean> {
  const n = await incr(kv, `bud:fetch:${nonce}`, 1, 3 * 3600);
  return n > limit;
}

export async function consumeByteBudget(kv: KVNamespace, nonce: string, bytes: number, limit: number): Promise<boolean> {
  const n = await incr(kv, `bud:bytes:${nonce}`, bytes, 3 * 3600);
  return n > limit;
}

export async function consumeHostCap(kv: KVNamespace, host: string, limit: number): Promise<boolean> {
  const n = await incr(kv, `bud:host:${host}`, 1, 3600);
  return n > limit;
}

export async function consumeGlobalEgress(kv: KVNamespace, bytes: number, limit: number): Promise<boolean> {
  const bucket = Math.floor(Date.now() / 3600000); // hourly window
  const n = await incr(kv, `bud:global:${bucket}`, bytes, 7200);
  return n > limit;
}
