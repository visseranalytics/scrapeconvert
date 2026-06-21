// Generic promise-pool limiter. Caps the number of concurrently running tasks
// (used for convert-time image fetches, 4-6 in flight) while still running all
// submitted tasks to completion.
export function createLimiter(max: number) {
  const limit = Math.max(1, Math.floor(max));
  let active = 0;
  const waiters: Array<() => void> = [];

  function release(): void {
    active--;
    const next = waiters.shift();
    if (next) next();
  }

  return async function run<T>(task: () => Promise<T>): Promise<T> {
    if (active >= limit) {
      await new Promise<void>((resolve) => waiters.push(resolve));
    }
    active++;
    try {
      return await task();
    } finally {
      release();
    }
  };
}
