import NextAuth, { CredentialsSignin } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";

// `code` surfaces to the login form via the caught error (see
// src/app/login/actions.ts) so it can show a specific message instead of
// the generic "Invalid username or password."
export class DeactivatedAccountSignin extends CredentialsSignin {
  code = "deactivated";
}

export const { handlers, signIn, signOut, auth } = NextAuth({
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
  },
  providers: [
    Credentials({
      credentials: {
        username: { label: "Username", type: "text" },
        password: { label: "Password", type: "password" },
      },
      authorize: async (credentials) => {
        const username = credentials?.username;
        const password = credentials?.password;
        if (typeof username !== "string" || typeof password !== "string") {
          return null;
        }

        const user = await prisma.user.findUnique({
          where: { username },
          include: { employee: true },
        });
        if (!user) return null;

        const passwordValid = await bcrypt.compare(password, user.passwordHash);
        if (!passwordValid) return null;

        // A deactivated or removed employee's login must stop working
        // immediately — an ADMIN account with no linked employee is exempt.
        if (user.employee && (user.employee.status !== "ACTIVE" || user.employee.deletedAt)) {
          throw new DeactivatedAccountSignin();
        }

        return {
          id: user.id,
          name: user.employee?.name ?? user.username,
          username: user.username,
          role: user.role,
          employeeId: user.employeeId,
        };
      },
    }),
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.role = user.role;
        token.username = user.username;
        token.employeeId = user.employeeId;
      }
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id = token.sub as string;
        session.user.role = token.role as "ADMIN" | "MEMBER";
        session.user.username = token.username as string;
        session.user.employeeId = (token.employeeId as string | null) ?? null;
      }
      return session;
    },
  },
});
