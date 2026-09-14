import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";

export const { handlers, signIn, signOut, auth } = NextAuth({
  trustHost: true,
  session: { strategy: "jwt", maxAge: 60 * 60 * 12 },
  pages: {
    signIn: "/",
  },
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
        remember: { label: "Remember me", type: "text" },
      },
      authorize: async (credentials) => {
        const email = String(credentials.email ?? "")
          .trim()
          .toLowerCase();
        const password = String(credentials.password ?? "");
        if (!email || !password) return null;

        try {
          const user = await prisma.user.findFirst({
            where: { email: { equals: email, mode: "insensitive" } },
          });
          if (!user || !user.confirmedAndActive || !user.passwordHash) {
            return null;
          }

          const ok = await bcrypt.compare(password, user.passwordHash);
          if (!ok) return null;

          return {
            id: user.id,
            email: user.email,
            name: user.name,
            support: user.support,
            sessionVersion: Number(user.sessionVersion ?? 0),
          };
        } catch (error) {
          console.error("[auth] authorize failed", error);
          return null;
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id!;
        token.support = Boolean(user.support);
        token.sessionVersion = Number(user.sessionVersion ?? 0);
        token.name = user.name;
        token.email = user.email;
        return token;
      }

      const id = String(token.id ?? "");
      if (!id) return token;

      try {
        const dbUser = await prisma.user.findUnique({
          where: { id },
          select: {
            support: true,
            confirmedAndActive: true,
            sessionVersion: true,
            name: true,
            email: true,
          },
        });
        if (!dbUser?.confirmedAndActive) {
          return null;
        }
        if (Number(dbUser.sessionVersion ?? 0) !== Number(token.sessionVersion ?? 0)) {
          return null;
        }
        token.support = dbUser.support;
        token.name = dbUser.name;
        token.email = dbUser.email;
        return token;
      } catch {
        return token;
      }
    },
    session({ session, token }) {
      if (!token?.id) {
        session.user.id = "";
        session.user.support = false;
        return session;
      }
      session.user.id = String(token.id);
      session.user.support = Boolean(token.support);
      session.user.name = typeof token.name === "string" ? token.name : "";
      session.user.email = typeof token.email === "string" ? token.email : "";
      return session;
    },
  },
});
