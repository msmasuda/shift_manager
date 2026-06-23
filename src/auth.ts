import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import Credentials from "next-auth/providers/credentials";
import { prisma } from "@/lib/prisma";
import { authConfig } from "./auth.config";
import type { UserRole } from "@/types";

const devCredentialsProvider = Credentials({
  id: "dev-credentials",
  name: "開発用ログイン",
  credentials: { email: { label: "Email", type: "email" } },
  authorize: async (credentials) => {
    const email = credentials?.email as string | undefined;
    if (!email) return null;
    const user = await prisma.user.findFirst({
      where: { email },
      select: { id: true, email: true, name: true },
    });
    return user ?? null;
  },
});

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Google,
    ...(process.env.NODE_ENV === "development" ? [devCredentialsProvider] : []),
  ],
  callbacks: {
    ...authConfig.callbacks,
    signIn: async ({ user }) => {
      if (!user.email) return false;
      const dbUser = await prisma.user.findFirst({
        where: { email: user.email },
        select: { id: true },
      });
      return !!dbUser;
    },
    jwt: async ({ token, user }) => {
      if (user?.email) {
        const dbUser = await prisma.user.findFirst({
          where: { email: user.email },
          select: { id: true, organizationId: true, role: true },
        });
        if (dbUser) {
          token.userId = dbUser.id;
          token.organizationId = dbUser.organizationId;
          token.role = dbUser.role as UserRole;
        }
      }
      return token;
    },
  },
});
