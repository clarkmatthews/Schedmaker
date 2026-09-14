type Bucket = { count: number; resetAt: number };

// In-memory limiter for a single Node process. Replace with Redis if you run multiple instances.

const buckets = new Map<string, Bucket>();
const WINDOW_MS = 15 * 60 * 1000;

function prune(now: number) {
  if (buckets.size < 500) return;
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }
}

export function isRateLimited(key: string, limit: number, windowMs = WINDOW_MS) {
  const now = Date.now();
  const bucket = buckets.get(key);
  return Boolean(bucket && bucket.resetAt > now && bucket.count >= limit);
}

export function hitRateLimit(key: string, windowMs = WINDOW_MS) {
  const now = Date.now();
  prune(now);
  const bucket = buckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return;
  }
  bucket.count += 1;
}

export function resetRateLimit(key: string) {
  buckets.delete(key);
}
