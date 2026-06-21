import { describe, it, expect } from 'vitest';
import { isBlockedIp, isSafePublicUrl } from './url-safety';

describe('isBlockedIp — IPv4 special-use ranges', () => {
  const blocked = [
    '0.0.0.0', '0.1.2.3',            // 0/8
    '10.0.0.1', '10.255.255.255',    // 10/8
    '100.64.0.1', '100.127.255.255', // 100.64/10 CGNAT
    '127.0.0.1', '127.1.2.3',        // 127/8 loopback
    '169.254.0.1', '169.254.169.254',// 169.254/16 link-local + cloud metadata
    '172.16.0.1', '172.31.255.255',  // 172.16/12
    '192.0.0.1',                     // 192.0.0/24
    '192.0.2.5',                     // 192.0.2/24 TEST-NET-1
    '192.168.0.1', '192.168.255.255',// 192.168/16
    '198.18.0.1', '198.19.255.255',  // 198.18/15 benchmarking
    '198.51.100.7',                  // 198.51.100/24 TEST-NET-2
    '203.0.113.7',                   // 203.0.113/24 TEST-NET-3
    '224.0.0.1', '239.255.255.255',  // 224/4 multicast
    '240.0.0.1', '254.255.255.255',  // 240/4 reserved
    '255.255.255.255',               // limited broadcast
  ];
  for (const ip of blocked) it(`blocks ${ip}`, () => expect(isBlockedIp(ip)).toBe(true));

  const allowed = ['1.1.1.1', '8.8.8.8', '93.184.216.34', '172.15.255.255', '172.32.0.1', '11.0.0.1'];
  for (const ip of allowed) it(`allows public ${ip}`, () => expect(isBlockedIp(ip)).toBe(false));
});

describe('isBlockedIp — IPv6 special-use ranges', () => {
  const blocked = [
    '::1',                 // loopback
    '::',                  // unspecified
    '::ffff:127.0.0.1',    // IPv4-mapped loopback -> re-test embedded v4
    '::ffff:10.0.0.1',     // IPv4-mapped private
    '::ffff:169.254.169.254',
    'fe80::1',             // link-local
    'fc00::1', 'fd12:3456::1', // ULA fc00::/7
    'ff02::1',             // multicast ff00::/8
    '2001:db8::1',         // doc 2001:db8::/32
    '64:ff9b::1.2.3.4',    // NAT64 64:ff9b::/96
  ];
  for (const ip of blocked) it(`blocks ${ip}`, () => expect(isBlockedIp(ip)).toBe(true));

  const allowed = ['2606:4700:4700::1111', '2001:4860:4860::8888'];
  for (const ip of allowed) it(`allows public ${ip}`, () => expect(isBlockedIp(ip)).toBe(false));
});

describe('isSafePublicUrl — scheme + host-encoding gauntlet', () => {
  it('accepts a plain https public host', () => {
    const r = isSafePublicUrl('https://example.com/a/b?c=1');
    expect(r.ok).toBe(true);
  });
  it('accepts http', () => expect(isSafePublicUrl('http://example.com/').ok).toBe(true));

  it('rejects non-http schemes', () => {
    for (const u of ['ftp://example.com', 'file:///etc/passwd', 'gopher://x', 'data:text/plain,hi', 'javascript:alert(1)']) {
      expect(isSafePublicUrl(u).ok).toBe(false);
    }
  });
  it('rejects credentials in URL', () => {
    expect(isSafePublicUrl('https://user:pass@example.com/').ok).toBe(false);
    expect(isSafePublicUrl('https://user@example.com/').ok).toBe(false);
  });
  it('rejects localhost and loopback names', () => {
    for (const u of ['http://localhost/', 'http://localhost:8080/', 'http://127.0.0.1/', 'http://[::1]/']) {
      expect(isSafePublicUrl(u).ok).toBe(false);
    }
  });
  it('rejects IP literals in decimal/octal/hex/dotted-private forms', () => {
    for (const u of [
      'http://2130706433/',      // decimal 127.0.0.1
      'http://017700000001/',    // octal 127.0.0.1
      'http://0x7f000001/',      // hex 127.0.0.1
      'http://0x7f.0.0.1/',      // mixed hex octet
      'http://192.168.1.1/',     // dotted private
      'http://[::ffff:127.0.0.1]/', // mapped loopback literal
    ]) {
      expect(isSafePublicUrl(u).ok).toBe(false);
    }
  });
  it('rejects trailing-dot loopback', () => {
    expect(isSafePublicUrl('http://127.0.0.1./').ok).toBe(false);
  });
  it('rejects non-standard ports', () => {
    for (const u of ['http://example.com:8080/', 'https://example.com:8443/', 'http://example.com:22/']) {
      expect(isSafePublicUrl(u).ok).toBe(false);
    }
    expect(isSafePublicUrl('http://example.com:80/').ok).toBe(true);
    expect(isSafePublicUrl('https://example.com:443/').ok).toBe(true);
  });
  it('rejects garbage', () => {
    expect(isSafePublicUrl('not a url').ok).toBe(false);
    expect(isSafePublicUrl('').ok).toBe(false);
  });
});
