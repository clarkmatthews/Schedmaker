"use server";

import bcrypt from "bcryptjs";
import { AuthError } from "next-auth";
import { redirect } from "next/navigation";
import { signIn } from "@/auth";
import { prisma } from "@/lib/db";
import { emptyToNull } from "@/lib/utils";
import { consumeEmailToken, issueEmailToken } from "@/lib/tokens";
import { notifyActivation, notifyPasswordReset } from "@/lib/notifications";
import { ActionError, requireSession } from "@/lib/permissions";

function appUrl() {
  return process.env.AUTH_URL ?? "http://localhost:3000";
}

export async function signupAction(formData: FormData) {
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
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");
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
      return { error: "Incorrect email or password, or the account is not activated." };
    }
  } catch (error) {
    if (error instanceof AuthError) {
      return { error: "Incorrect email or password, or the account is not activated." };
    }
    throw error;
  }
  redirect("/app");
}

export async function activateAction(token: string, formData: FormData) {
  const password = String(formData.get("password") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const phoneNumber = emptyToNull(String(formData.get("phoneNumber") ?? ""));
  const tos = String(formData.get("tos") ?? "");

  if (password.length < 6) {
    return { error: "Your password must be at least 6 characters long." };
  }
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
  if (password.length < 6) {
    return { error: "Your password must be at least 6 characters long." };
  }
  const row = await consumeEmailToken(token, "reset");
  if (!row) {
    return { error: "This reset link is invalid or expired." };
  }
  const passwordHash = await bcrypt.hash(password, 10);
  await prisma.user.update({
    where: { id: row.userId },
    data: { passwordHash, confirmedAndActive: true },
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
  const password = String(formData.get("password") ?? "");
  if (password.length < 6) {
    return { error: "Your password must be at least 6 characters long." };
  }
  const passwordHash = await bcrypt.hash(password, 10);
  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash },
  });
  return { ok: true as const };
}
