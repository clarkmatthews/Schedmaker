import { type DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      support: boolean;
    } & DefaultSession["user"];
  }

  interface User {
    support: boolean;
    sessionVersion: number;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?: string;
    support?: boolean;
    sessionVersion?: number;
  }
}
