export interface RetryOpts {
  retries: number;
  baseDelayMs: number;
  isRetryable: (err: unknown) => boolean;
  onRetry?: (attempt: number, err: unknown) => void;
  signal?: AbortSignal;
}

function isAbortError(err: unknown): boolean {
  if (err instanceof Error && (err.name === "AbortError" || err.name === "APIUserAbortError")) return true;
  return false;
}

export async function withRetry<T>(
  fn: () => Promise<T>,
  opts: RetryOpts,
): Promise<T> {
  let lastErr: unknown;
  for (let attempt = 0; attempt <= opts.retries; attempt++) {
    if (opts.signal?.aborted) throw new DOMException("Aborted", "AbortError");
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (isAbortError(err) || opts.signal?.aborted) throw err;
      if (attempt === opts.retries || !opts.isRetryable(err)) throw err;
      opts.onRetry?.(attempt, err);
      const delay = opts.baseDelayMs * Math.pow(3, attempt) + Math.floor(Math.random() * 200);
      await new Promise((resolve, reject) => {
        const timer = setTimeout(resolve, delay);
        opts.signal?.addEventListener(
          "abort",
          () => {
            clearTimeout(timer);
            reject(new DOMException("Aborted", "AbortError"));
          },
          { once: true },
        );
      });
    }
  }
  throw lastErr;
}
