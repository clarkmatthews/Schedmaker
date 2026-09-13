import { randomBytes } from "crypto";
import { prisma } from "@/lib/db";

export function createRawToken() {
  return randomBytes(32).toString("hex");
}

export async function issueEmailToken(params: {
  userId: string;
  email: string;
  type: "activate" | "reset" | "email_change";
  hours?: number;
}) {
  const token = createRawToken();
  const hours = params.hours ?? 2;
  await prisma.emailToken.create({
    data: {
      token,
      type: params.type,
      email: params.email,
      userId: params.userId,
      expiresAt: new Date(Date.now() + hours * 60 * 60 * 1000),
    },
  });
  return token;
}

export async function consumeEmailToken(token: string, type: string) {
  const row = await prisma.emailToken.findUnique({
    where: { token },
    include: { user: true },
  });
  if (!row || row.type !== type || row.expiresAt < new Date()) {
    return null;
  }
  await prisma.emailToken.delete({ where: { id: row.id } });
  return row;
}
