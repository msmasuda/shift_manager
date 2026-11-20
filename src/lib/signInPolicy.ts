import type { Account, Profile, User } from "next-auth";
import { prisma } from "@/lib/prisma";

/**
 * サインインを許可するか。事前登録されたメールアドレスのユーザーだけを通す。
 * Google はメール未確認のアカウントも作れるため、email_verified が true でなければ拒否する
 * （確認していないと、他人のメールアドレスで作った Google アカウントでその人としてログインできてしまう）。
 */
export async function allowSignIn({
  user,
  account,
  profile,
}: {
  user: User;
  account?: Account | null;
  profile?: Profile;
}): Promise<boolean> {
  if (!user.email) return false;
  if (account?.provider === "google" && profile?.email_verified !== true) return false;

  const dbUser = await prisma.user.findUnique({
    where: { email: user.email },
    select: { id: true },
  });
  return !!dbUser;
}
