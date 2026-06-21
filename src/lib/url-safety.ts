// Shared scheme + special-use IP filter. Used by the server SSRF guard
// and the client-side <img src> filter. No network, no node:*.

type Bytes = number[];

function parseIpv4(s: string): Bytes | null {
  // Accept dotted forms only here (decimal/octal/hex single-number forms are
  // handled by parseIpv4Number). Each octet may be decimal, 0x-hex, or
  // 0-prefixed octal, all of which appear in SSRF bypasses.
  const trimmed = s.endsWith('.') ? s.slice(0, -1) : s;
  const parts = trimmed.split('.');
  if (parts.length !== 4) return null;
  const out: Bytes = [];
  for (const p of parts) {
    if (p === '') return null;
    let n: number;
    if (/^0x[0-9a-f]+$/i.test(p)) n = parseInt(p, 16);
    else if (/^0[0-7]+$/.test(p)) n = parseInt(p, 8);
    else if (/^[0-9]+$/.test(p)) n = parseInt(p, 10);
    else return null;
    if (!Number.isInteger(n) || n < 0 || n > 255) return null;
    out.push(n);
  }
  return out;
}

function parseIpv4Number(s: string): Bytes | null {
  // Single-number IPv4: decimal/octal/hex (e.g. 2130706433, 0x7f000001, 017700000001)
  const t = s.endsWith('.') ? s.slice(0, -1) : s;
  let n: number | null = null;
  if (/^0x[0-9a-f]+$/i.test(t)) n = parseInt(t, 16);
  else if (/^0[0-7]+$/.test(t)) n = parseInt(t, 8);
  else if (/^[0-9]+$/.test(t)) n = Number(t);
  if (n === null || !Number.isFinite(n) || n < 0 || n > 0xffffffff) return null;
  return [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255];
}

function parseIpv6(s: string): Bytes | null {
  let str = s;
  // strip zone id
  const pct = str.indexOf('%');
  if (pct !== -1) str = str.slice(0, pct);
  if (!str.includes(':')) return null;
  // Replace a trailing embedded IPv4 (::ffff:1.2.3.4 / 64:ff9b::1.2.3.4) with the
  // two hex groups it represents, then parse as a standard 8-group IPv6 address.
  const lastColon = str.lastIndexOf(':');
  const maybeV4 = str.slice(lastColon + 1);
  if (maybeV4.includes('.')) {
    const v4 = parseIpv4(maybeV4);
    if (!v4) return null;
    const g1 = ((v4[0] << 8) | v4[1]).toString(16);
    const g2 = ((v4[2] << 8) | v4[3]).toString(16);
    str = str.slice(0, lastColon + 1) + g1 + ':' + g2;
  }
  const halves = str.split('::');
  if (halves.length > 2) return null;
  const expand = (h: string) => (h === '' ? [] : h.split(':'));
  const head = expand(halves[0]);
  const back = halves.length === 2 ? expand(halves[1]) : [];
  const explicit = head.length + back.length;
  if (halves.length === 1) {
    if (explicit !== 8) return null;
  } else if (explicit > 7) {
    return null; // '::' must compress at least one group
  }
  const fill = halves.length === 2 ? 8 - explicit : 0;
  const groups = [...head, ...Array(fill).fill('0'), ...back];
  if (groups.length !== 8) return null;
  const bytes: Bytes = [];
  for (const g of groups) {
    if (!/^[0-9a-f]{1,4}$/i.test(g)) return null;
    const v = parseInt(g, 16);
    bytes.push((v >> 8) & 255, v & 255);
  }
  return bytes.length === 16 ? bytes : null;
}

function inRange(bytes: Bytes, prefix: Bytes, bits: number): boolean {
  let remaining = bits;
  for (let i = 0; i < prefix.length && remaining > 0; i++) {
    const take = Math.min(8, remaining);
    const mask = take === 8 ? 0xff : (0xff << (8 - take)) & 0xff;
    if ((bytes[i] & mask) !== (prefix[i] & mask)) return false;
    remaining -= take;
  }
  return true;
}

function v4Blocked(b: Bytes): boolean {
  const R: [Bytes, number][] = [
    [[0, 0, 0, 0], 8], [[10, 0, 0, 0], 8], [[100, 64, 0, 0], 10],
    [[127, 0, 0, 0], 8], [[169, 254, 0, 0], 16], [[172, 16, 0, 0], 12],
    [[192, 0, 0, 0], 24], [[192, 0, 2, 0], 24], [[192, 168, 0, 0], 16],
    [[198, 18, 0, 0], 15], [[198, 51, 100, 0], 24], [[203, 0, 113, 0], 24],
    [[224, 0, 0, 0], 4], [[240, 0, 0, 0], 4],
  ];
  if (b[0] === 255 && b[1] === 255 && b[2] === 255 && b[3] === 255) return true;
  return R.some(([p, bits]) => inRange(b, p, bits));
}

function v6Blocked(b: Bytes): boolean {
  // IPv4-mapped ::ffff:0:0/96 -> re-test embedded v4
  const mappedPrefix = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0xff, 0xff];
  if (inRange(b, mappedPrefix, 96)) return v4Blocked(b.slice(12));
  // 64:ff9b::/96 NAT64 -> block the prefix outright (it bridges to other networks)
  const nat64 = [0, 0x64, 0xff, 0x9b, 0, 0, 0, 0, 0, 0, 0, 0];
  if (inRange(b, nat64, 96)) return true;
  const isZero = b.every((x) => x === 0);
  if (isZero) return true; // ::
  const isLoop = b.slice(0, 15).every((x) => x === 0) && b[15] === 1;
  if (isLoop) return true; // ::1
  const R: [Bytes, number][] = [
    [[0xfe, 0x80], 10],     // fe80::/10 link-local
    [[0xfc], 7],            // fc00::/7 ULA
    [[0xff], 8],            // ff00::/8 multicast
    [[0x20, 0x01, 0x0d, 0xb8], 32], // 2001:db8::/32 doc
  ];
  return R.some(([p, bits]) => inRange(b, p, bits));
}

export function isBlockedIp(ip: string): boolean {
  const v6 = parseIpv6(ip);
  if (v6) return v6Blocked(v6);
  const dotted = parseIpv4(ip);
  if (dotted) return v4Blocked(dotted);
  const single = parseIpv4Number(ip);
  if (single) return v4Blocked(single);
  return false; // not an IP literal; hostname safety is handled by resolve-and-validate
}

function hostLooksLikeIp(host: string): boolean {
  return (
    parseIpv4(host) !== null ||
    parseIpv4Number(host) !== null ||
    (host.startsWith('[') && host.endsWith(']'))
  );
}

export function isSafePublicUrl(
  raw: string,
): { ok: true; url: URL } | { ok: false; reason: string } {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return { ok: false, reason: 'unparseable' };
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    return { ok: false, reason: 'scheme' };
  }
  if (url.username || url.password) return { ok: false, reason: 'credentials' };
  // non-standard ports
  const port = url.port;
  if (port && !((url.protocol === 'http:' && port === '80') || (url.protocol === 'https:' && port === '443'))) {
    return { ok: false, reason: 'port' };
  }
  let host = url.hostname.toLowerCase();
  if (host.endsWith('.')) host = host.slice(0, -1);
  if (host === 'localhost') return { ok: false, reason: 'localhost' };
  // bracketed IPv6 literal
  if (host.startsWith('[') && host.endsWith(']')) {
    if (isBlockedIp(host.slice(1, -1))) return { ok: false, reason: 'private-ip' };
    return { ok: true, url };
  }
  if (hostLooksLikeIp(host)) {
    if (isBlockedIp(host)) return { ok: false, reason: 'private-ip' };
    return { ok: true, url };
  }
  return { ok: true, url };
}
