import type { Role } from "@/generated/prisma/enums";
import "next-auth";
import "next-auth/jwt";

declare module "next-auth" {
  interface User {
    role: Role;
    username: string;
    employeeId: string | null;
  }

  interface Session {
    user: {
      id: string;
      role: Role;
      username: string;
      employeeId: string | null;
      name?: string | null;
      email?: string | null;
      image?: string | null;
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    role: Role;
    username: string;
    employeeId: string | null;
  }
}
