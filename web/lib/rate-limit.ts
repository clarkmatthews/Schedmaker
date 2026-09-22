import { prisma } from "@/lib/db";

// Shared Postgres counters so a second app process sees the same limits.
// The client address is the last X-Forwarded-For hop, which is the one a
// reverse proxy appends, rather than the first value a caller can forge.

const WINDOW_MS = 15 * 60 * 1000;

export async function isRateLimited(key: string, limit: number, windowMs = WINDOW_MS) {
  const row = await prisma.authRateLimit.findUnique({ where: { key } });
  if (!row || row.resetAt.getTime() <= Date.now()) return false;
  return row.count >= limit;
}

export async function hitRateLimit(key: string, windowMs = WINDOW_MS) {
  const resetAt = new Date(Date.now() + windowMs);
  await prisma.$executeRaw`
    INSERT INTO "AuthRateLimit" ("key", "count", "resetAt")
    VALUES (${key}, 1, ${resetAt})
    ON CONFLICT ("key") DO UPDATE
    SET
      "count" = CASE
        WHEN "AuthRateLimit"."resetAt" <= NOW() THEN 1
        ELSE "AuthRateLimit"."count" + 1
      END,
      "resetAt" = CASE
        WHEN "AuthRateLimit"."resetAt" <= NOW() THEN ${resetAt}
        ELSE "AuthRateLimit"."resetAt"
      END
  `;
}

export async function resetRateLimit(key: string) {
  await prisma.authRateLimit.deleteMany({ where: { key } });
}
