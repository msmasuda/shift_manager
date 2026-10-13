import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import Credentials from "next-auth/providers/credentials";
import bcryptjs from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { authConfig } from "./auth.config";
import { isLockedOut, recordLoginFailure, clearLoginFailures } from "@/lib/loginThrottle";
import type { UserRole } from "@/types";

const credentialsProvider = Credentials({
  id: "credentials",
  name: "Email & Password",
  credentials: {
    email: { label: "Email", type: "email" },
    password: { label: "Password", type: "password" },
  },
  authorize: async (credentials) => {
    const email = credentials?.email as string | undefined;
    const password = credentials?.password as string | undefined;
    if (!email || !password) return null;
    if (isLockedOut(email)) return null;

    const user = await prisma.user.findUnique({
      where: { email },
      select: { id: true, email: true, name: true, passwordHash: true },
    });
    const valid = !!user?.passwordHash && (await bcryptjs.compare(password, user.passwordHash));
    if (!user || !valid) {
      recordLoginFailure(email);
      return null;
    }
    clearLoginFailures(email);

    return { id: user.id, email: user.email, name: user.name };
  },
});

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    ...(process.env.AUTH_GOOGLE_ID ? [Google] : []),
    credentialsProvider,
  ],
  callbacks: {
    ...authConfig.callbacks,
    signIn: async ({ user }) => {
      if (!user.email) return false;
      const dbUser = await prisma.user.findUnique({
        where: { email: user.email },
        select: { id: true },
      });
      return !!dbUser;
    },
    // auth() のたびに DB から読み直し、ロール変更・ユーザー削除を再ログインを待たずに反映する
    jwt: async ({ token, user }) => {
      const where = user?.email
        ? { email: user.email }
        : token.userId
          ? { id: token.userId as string }
          : null;
      if (!where) return null;
      const dbUser = await prisma.user.findUnique({
        where,
        select: { id: true, organizationId: true, role: true },
      });
      if (!dbUser) return null; // 削除済みユーザーはセッション無効
      token.userId = dbUser.id;
      token.organizationId = dbUser.organizationId;
      token.role = dbUser.role as UserRole;
      return token;
    },
  },
});
