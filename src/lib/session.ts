// Session-token lifecycle. The token is an opaque signed string from
// POST /api/turnstile, stored in sessionStorage (survives reload within a tab).
// A single in-flight mint promise coordinates concurrent callers so a burst of
// 401s does not trigger multiple Turnstile mints.

const KEY = 'sc.sessionToken';

export function getSessionToken(): string | null {
  try {
    return sessionStorage.getItem(KEY);
  } catch {
    return null;
  }
}

export function setSessionToken(token: string): void {
  try {
    sessionStorage.setItem(KEY, token);
  } catch {
    /* storage unavailable (private mode); token stays in-memory for this call only */
  }
}

export function clearSessionToken(): void {
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}

let inflight: Promise<string> | null = null;

export async function mintSession(turnstileToken: string): Promise<string> {
  if (inflight) return inflight;
  inflight = (async () => {
    const res = await fetch('/api/turnstile', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ token: turnstileToken }),
    });
    if (!res.ok) throw new Error('mint-failed:' + res.status);
    const data = (await res.json()) as { sessionToken?: string };
    if (!data.sessionToken) throw new Error('mint-no-token');
    setSessionToken(data.sessionToken);
    return data.sessionToken;
  })();
  try {
    return await inflight;
  } finally {
    inflight = null;
  }
}
