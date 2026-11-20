import bcryptjs from "bcryptjs";
import { prisma } from "@/lib/prisma";

/**
 * ユーザーが存在しない・パスワード未設定のときに比較させるダミーのハッシュ。
 * bcrypt を省くと応答が 40 倍ほど速くなり、メールアドレスが登録済みかどうかが応答時間で分かってしまう。
 * コスト（$12$）は src/app/api/users/route.ts と prisma/seed.ts の bcryptjs.hash(…, 12) と揃えること。
 */
export const DUMMY_PASSWORD_HASH = "$2b$12$xnuH5zecFSIFGHTLCzGySObUVPvi3TdWL.qp2A2qPKkkI5F3pZ61m";

export type VerifiedUser = { id: string; email: string; name: string };

/** メールアドレスとパスワードを検証する。ユーザーの有無に関わらず bcrypt の比較を必ず 1 回行う */
export async function verifyCredentials(email: string, password: string): Promise<VerifiedUser | null> {
  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, email: true, name: true, passwordHash: true },
  });
  const valid = await bcryptjs.compare(password, user?.passwordHash ?? DUMMY_PASSWORD_HASH);
  if (!user?.passwordHash || !valid) return null;
  return { id: user.id, email: user.email, name: user.name };
}
