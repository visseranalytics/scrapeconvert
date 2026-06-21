// Node-pool test setup: assert WebCrypto is present (we never use node:crypto).
import { expect } from 'vitest';
if (typeof globalThis.crypto?.subtle === 'undefined') {
  throw new Error('WebCrypto crypto.subtle missing; run on Node 20+');
}
expect.hasAssertions;
