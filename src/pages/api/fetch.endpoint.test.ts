import { describe, it, expect, beforeEach } from 'vitest';
import { env } from 'cloudflare:test';
import { GET } from './fetch';
import { __setHooks, __resetHooks } from '../../server/proxy';
import { mintSession } from '../../server/turnstile';

/* eslint-disable @typescript-eslint/no-explicit-any */
const IP = '8.8.8.8';
const secret = () => (env as any).SESSION_HMAC_SECRET as string;

async function validToken() {
  return mintSession(IP, secret(), 2700);
}
function fetchReq(target: string, token: string | null, type = 'page') {
  const u = new URL('https://scrapeconvert.com/api/fetch');
  u.searchParams.set('url', target);
  u.searchParams.set('type', type);
  const headers: Record<string, string> = { 'cf-connecting-ip': IP };
  if (token) headers['authorization'] = `Bearer ${token}`;
  return new Request(u.href, { headers });
}
const asCtx = (request: Request) => ({ request }) as any;

beforeEach(() => __resetHooks());

describe('GET /api/fetch', () => {
  it('401 when no token', async () => {
    const res = await GET(asCtx(fetchReq('https://example.com/', null)));
    expect(res.status).toBe(401);
  });

  it('401 on a forged token', async () => {
    const res = await GET(asCtx(fetchReq('https://example.com/', 'a.b')));
    expect(res.status).toBe(401);
  });

  it('401 on ip mismatch', async () => {
    const t = await mintSession('1.1.1.1', secret(), 2700);
    const res = await GET(asCtx(fetchReq('https://example.com/', t))); // request IP is 8.8.8.8
    expect(res.status).toBe(401);
  });

  it('400 on a blocked URL (private IP)', async () => {
    const res = await GET(asCtx(fetchReq('http://169.254.169.254/', await validToken())));
    expect(res.status).toBe(400);
  });

  it('400 on own-zone target', async () => {
    const res = await GET(asCtx(fetchReq('https://scrapeconvert.com/secret', await validToken())));
    expect(res.status).toBe(400);
  });

  it('200 relays page bytes', async () => {
    __setHooks({
      resolve: async () => ({ ok: true, ips: ['93.184.216.34'] }),
      connect: async () => {
        const enc = new TextEncoder();
        return new ReadableStream<Uint8Array>({
          pull(c) {
            c.enqueue(enc.encode('HTTP/1.1 200 OK\r\ncontent-type: text/html\r\n\r\n<html>'));
            c.close();
          },
        });
      },
    });
    const res = await GET(asCtx(fetchReq('https://example.com/', await validToken())));
    expect(res.status).toBe(200);
    expect(await res.text()).toContain('<html>');
  });

  it('413 maps from an over-cap ProxyError', async () => {
    __setHooks({
      resolve: async () => ({ ok: true, ips: ['93.184.216.34'] }),
      connect: async () => {
        const enc = new TextEncoder();
        const big = new Uint8Array(6 * 1024 * 1024);
        let sent = false;
        return new ReadableStream<Uint8Array>({
          pull(c) {
            if (!sent) {
              c.enqueue(enc.encode('HTTP/1.1 200 OK\r\ncontent-type: text/html\r\n\r\n'));
              sent = true;
              return;
            }
            c.enqueue(big);
            c.close();
          },
        });
      },
    });
    const res = await GET(asCtx(fetchReq('https://example.com/', await validToken())));
    expect([413, 200]).toContain(res.status);
    if (res.status === 200) {
      await expect(res.text()).rejects.toBeTruthy();
    }
  });

  it('502 maps from an upstream error', async () => {
    __setHooks({
      resolve: async () => ({ ok: true, ips: ['93.184.216.34'] }),
      connect: async () => {
        const enc = new TextEncoder();
        return new ReadableStream<Uint8Array>({
          pull(c) {
            c.enqueue(enc.encode('HTTP/1.1 500 Err\r\ncontent-type: text/html\r\n\r\n'));
            c.close();
          },
        });
      },
    });
    const res = await GET(asCtx(fetchReq('https://example.com/', await validToken())));
    expect(res.status).toBe(502);
  });

  it('400 on unknown type', async () => {
    const res = await GET(asCtx(fetchReq('https://example.com/', await validToken(), 'bogus')));
    expect(res.status).toBe(400);
  });
});
