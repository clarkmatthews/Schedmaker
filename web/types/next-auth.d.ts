import { type DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      support: boolean;
      mustChangePassword: boolean;
    } & DefaultSession["user"];
  }

  interface User {
    support: boolean;
    sessionVersion: number;
    mustChangePassword: boolean;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?: string;
    support?: boolean;
    sessionVersion?: number;
    mustChangePassword?: boolean;
  }
}
