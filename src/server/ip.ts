function coarsen(ip: string): string {
  if (ip.includes(':')) {
    // IPv6 -> /64 (first 4 hextets)
    const expanded = ip.split('%')[0];
    const groups = expanded.split(':');
    return groups.slice(0, 4).join(':') + '::/64';
  }
  const parts = ip.split('.');
  if (parts.length === 4) return `${parts[0]}.${parts[1]}.${parts[2]}.0/24`;
  return ip; // unknown form: hash as-is
}

export async function clientIpHash(ip: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(coarsen(ip || 'unknown')));
  const bytes = new Uint8Array(digest);
  let hex = '';
  for (const b of bytes) hex += b.toString(16).padStart(2, '0');
  return hex.slice(0, 32);
}
