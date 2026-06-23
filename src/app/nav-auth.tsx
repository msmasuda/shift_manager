"use client";

import { useSession, signOut } from "next-auth/react";
import Link from "next/link";

export function NavAuth() {
  const { data: session } = useSession();

  if (!session) return null;

  const isAdmin = session.user.role === "ADMIN";

  return (
    <>
      <Link
        href="/my-shifts"
        className="text-sm font-medium text-textMuted hover:text-white transition-colors"
      >
        自分のシフト
      </Link>
      <Link
        href={isAdmin ? "/admin" : "/schedule"}
        className="text-sm font-medium text-textMuted hover:text-white transition-colors"
      >
        {isAdmin ? "管理者" : "一覧"}
      </Link>
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
    </>
  );
}
