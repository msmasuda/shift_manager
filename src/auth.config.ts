import Google from "next-auth/providers/google";
import type { NextAuthConfig } from "next-auth";
import type { UserRole } from "@/types";

export const authConfig: NextAuthConfig = {
  providers: [Google],
  pages: { signIn: "/login" },
  session: { strategy: "jwt" },
  callbacks: {
    session: ({ session, token }) => ({
      ...session,
      user: {
        ...session.user,
        id: token.userId as string,
        organizationId: token.organizationId as string,
        role: token.role as UserRole,
      },
    }),
  },
};
