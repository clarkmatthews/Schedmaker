import { createHash, randomBytes } from "crypto";
import { prisma } from "@/lib/db";

const HASH_PREFIX = "sha256:";

export function createRawToken() {
  return randomBytes(32).toString("hex");
}

export function hashEmailToken(token: string) {
  if (token.startsWith(HASH_PREFIX)) return token;
  return `${HASH_PREFIX}${createHash("sha256").update(token).digest("hex")}`;
}

let upgradePromise: Promise<void> | null = null;

function upgradePlaintextTokens() {
  if (upgradePromise) return upgradePromise;
  upgradePromise = (async () => {
    const rows = await prisma.emailToken.findMany({
      select: { id: true, token: true },
    });
    for (const row of rows) {
      if (row.token.startsWith(HASH_PREFIX)) continue;
      await prisma.emailToken
        .update({
          where: { id: row.id },
          data: { token: hashEmailToken(row.token) },
        })
        .catch(() => undefined);
    }
  })().catch((error) => {
    upgradePromise = null;
    throw error;
  });
  return upgradePromise;
}

export async function issueEmailToken(params: {
  userId: string;
  email: string;
  type: "activate" | "reset" | "email_change";
  hours?: number;
}) {
  await upgradePlaintextTokens();
  const token = createRawToken();
  const hours = params.hours ?? 2;
  await prisma.emailToken.create({
    data: {
      token: hashEmailToken(token),
      type: params.type,
      email: params.email,
      userId: params.userId,
      expiresAt: new Date(Date.now() + hours * 60 * 60 * 1000),
    },
  });
  return token;
}

export async function consumeEmailToken(token: string, type: string) {
  await upgradePlaintextTokens();
  const row = await prisma.emailToken.findUnique({
    where: { token: hashEmailToken(token) },
    include: { user: true },
  });
  if (!row || row.type !== type || row.expiresAt < new Date()) {
    return null;
  }
  await prisma.emailToken.delete({ where: { id: row.id } });
  return row;
}
