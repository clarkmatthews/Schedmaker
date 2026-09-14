"use server";

import bcrypt from "bcryptjs";
import { headers } from "next/headers";
import { AuthError } from "next-auth";
import { redirect } from "next/navigation";
import { signIn, signOut } from "@/auth";
import { prisma } from "@/lib/db";
import { emptyToNull } from "@/lib/utils";
import { consumeEmailToken, issueEmailToken } from "@/lib/tokens";
import { notifyActivation, notifyPasswordReset } from "@/lib/notifications";
import { ActionError, requireSession } from "@/lib/permissions";
import { hitRateLimit, isRateLimited, resetRateLimit } from "@/lib/rate-limit";

const MIN_PASSWORD_LENGTH = 8;
const AUTH_RATE_LIMIT_MESSAGE = "Too many attempts. Try again in a few minutes.";
const LOGIN_FAIL_MESSAGE =
  "Incorrect email or password, or the account is not activated.";

function appUrl() {
  return process.env.AUTH_URL ?? "http://localhost:3000";
}

function passwordTooShort(password: string) {
  return password.length < MIN_PASSWORD_LENGTH
    ? `Your password must be at least ${MIN_PASSWORD_LENGTH} characters long.`
    : null;
}

async function clientIp() {
  const h = await headers();
  return (
    h.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    h.get("x-real-ip") ||
    "unknown"
  );
}

export async function signupAction(formData: FormData) {
  const ip = await clientIp();
  const signupKey = `signup:${ip}`;
  if (isRateLimited(signupKey, 5)) {
    return { error: AUTH_RATE_LIMIT_MESSAGE };
  }
  hitRateLimit(signupKey);

  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();
  if (!email) {
    return { error: "Email is required." };
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return { error: "An account with that email already exists. Try logging in or resetting your password." };
  }

  const user = await prisma.user.create({
    data: { email, name },
  });
  const token = await issueEmailToken({
    userId: user.id,
    email,
    type: "activate",
  });
  await notifyActivation(email, name, `${appUrl()}/activate/${token}`);
  return { ok: true as const };
}

export async function loginAction(formData: FormData) {
  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();
  const password = String(formData.get("password") ?? "");
  const ip = await clientIp();
  const loginKey = `login:${ip}:${email}`;
  if (isRateLimited(loginKey, 5)) {
    return { error: AUTH_RATE_LIMIT_MESSAGE };
  }
  try {
    const result = await signIn("credentials", {
      email,
      password,
      redirect: false,
      redirectTo: "/app",
    });
    const failed =
      result &&
      typeof result === "object" &&
      "error" in result &&
      Boolean((result as { error?: string }).error);
    if (failed) {
      hitRateLimit(loginKey);
      return { error: LOGIN_FAIL_MESSAGE };
    }
  } catch (error) {
    if (error instanceof AuthError) {
      hitRateLimit(loginKey);
      return { error: LOGIN_FAIL_MESSAGE };
    }
    throw error;
  }
  resetRateLimit(loginKey);
  redirect("/app");
}

export async function logoutAction() {
  await signOut({ redirectTo: "/" });
}

export async function activateAction(token: string, formData: FormData) {
  const password = String(formData.get("password") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const phoneNumber = emptyToNull(String(formData.get("phoneNumber") ?? ""));
  const tos = String(formData.get("tos") ?? "");

  const short = passwordTooShort(password);
  if (short) return { error: short };
  if (!tos) {
    return { error: "You must agree to the terms and conditions." };
  }

  const row = await consumeEmailToken(token, "activate");
  if (!row) {
    return { error: "This activation link is invalid or expired." };
  }

  const passwordHash = await bcrypt.hash(password, 10);
  await prisma.user.update({
    where: { id: row.userId },
    data: {
      email: row.email,
      name,
      phoneNumber,
      confirmedAndActive: true,
      passwordHash,
    },
  });

  const adminCount = await prisma.admin.count({ where: { userId: row.userId } });
  const workerCount = await prisma.worker.count({ where: { userId: row.userId } });
  const user = await prisma.user.findUnique({ where: { id: row.userId } });

  await signIn("credentials", {
    email: row.email,
    password,
    redirectTo:
      adminCount > 0 || user?.support
        ? "/app"
        : workerCount > 0
          ? "/account"
          : "/new-company",
  });
}

export async function requestPasswordResetAction(formData: FormData) {
  const ip = await clientIp();
  const resetKey = `reset:${ip}`;
  if (isRateLimited(resetKey, 5)) {
    return { error: AUTH_RATE_LIMIT_MESSAGE };
  }
  hitRateLimit(resetKey);

  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();
  if (!email) return { error: "Email is required." };

  const user = await prisma.user.findUnique({ where: { email } });
  if (user) {
    const token = await issueEmailToken({
      userId: user.id,
      email,
      type: "reset",
    });
    await notifyPasswordReset(email, `${appUrl()}/reset/${token}`);
  }
  return { ok: true as const };
}

export async function confirmPasswordResetAction(token: string, formData: FormData) {
  const password = String(formData.get("password") ?? "");
  const short = passwordTooShort(password);
  if (short) return { error: short };
  const row = await consumeEmailToken(token, "reset");
  if (!row) {
    return { error: "This reset link is invalid or expired." };
  }
  const passwordHash = await bcrypt.hash(password, 10);
  await prisma.user.update({
    where: { id: row.userId },
    data: {
      passwordHash,
      confirmedAndActive: true,
      sessionVersion: { increment: 1 },
    },
  });
  await signIn("credentials", {
    email: row.user.email,
    password,
    redirectTo: "/app",
  });
}

export async function updateAccountAction(formData: FormData) {
  const user = await requireSession();
  const name = String(formData.get("name") ?? "").trim();
  const phoneNumber = emptyToNull(String(formData.get("phoneNumber") ?? ""));
  const photoUrl = String(formData.get("photoUrl") ?? "").trim();

  try {
    await prisma.user.update({
      where: { id: user.id },
      data: { name, phoneNumber, photoUrl },
    });
    return { ok: true as const };
  } catch (error) {
    if (error instanceof ActionError) return { error: error.message };
    return { error: "Could not update account." };
  }
}

export async function updatePasswordAction(formData: FormData) {
  const user = await requireSession();
  const currentPassword = String(formData.get("currentPassword") ?? "");
  const password = String(formData.get("password") ?? "");
  const short = passwordTooShort(password);
  if (short) return { error: short };

  const existing = await prisma.user.findUnique({
    where: { id: user.id },
    select: { passwordHash: true, email: true },
  });
  if (!existing?.passwordHash) {
    return { error: "Current password is incorrect." };
  }
  const matches = await bcrypt.compare(currentPassword, existing.passwordHash);
  if (!matches) {
    return { error: "Current password is incorrect." };
  }

  const passwordHash = await bcrypt.hash(password, 10);
  await prisma.user.update({
    where: { id: user.id },
    data: {
      passwordHash,
      sessionVersion: { increment: 1 },
    },
  });
  await signIn("credentials", {
    email: existing.email,
    password,
    redirect: false,
  });
  return { ok: true as const };
}
