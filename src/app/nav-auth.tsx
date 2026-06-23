"use client";

import { useSession, signOut } from "next-auth/react";

export function NavAuth() {
  const { data: session } = useSession();

  if (!session) return null;

  return (
    <div className="flex items-center gap-4 border-l border-border/50 pl-4">
      <span className="text-sm text-textMuted hidden md:block truncate max-w-[120px]">
        {session.user.name}
      </span>
      <button
        onClick={() => signOut({ callbackUrl: "/login" })}
        className="text-sm font-medium text-textMuted hover:text-white transition-colors"
      >
        サインアウト
      </button>
    </div>
  );
}
