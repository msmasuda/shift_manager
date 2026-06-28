"use client";

import { useState } from "react";
import { useSession, signOut } from "next-auth/react";
import Link from "next/link";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

function NavLinks({ isAdmin, onClose }: { isAdmin: boolean; onClose?: () => void }) {
  return (
    <>
      <Link
        href="/my-shifts"
        onClick={onClose}
        className="text-sm font-medium text-textMuted hover:text-white transition-colors"
      >
        自分のシフト
      </Link>
      <Link
        href={isAdmin ? "/admin" : "/schedule"}
        onClick={onClose}
        className="text-sm font-medium text-textMuted hover:text-white transition-colors"
      >
        {isAdmin ? "管理者" : "一覧"}
      </Link>
      {isAdmin && (
        <Link
          href="/admin/organization"
          onClick={onClose}
          className="text-sm font-medium text-textMuted hover:text-white transition-colors"
        >
          企業情報
        </Link>
      )}
    </>
  );
}

export function NavAuth() {
  const { data: session } = useSession();
  const [open, setOpen] = useState(false);

  if (!session) return null;

  const isAdmin = session.user.role === "ADMIN";

  return (
    <>
      {/* Desktop nav */}
      <nav className="hidden md:flex items-center gap-6">
        <NavLinks isAdmin={isAdmin} />
        <div className="flex items-center gap-4 border-l border-border/50 pl-4">
          <span className="text-sm text-textMuted truncate max-w-[120px]">
            {session.user.name}
          </span>
          <button
            onClick={() => signOut({ callbackUrl: "/login" })}
            className="text-sm font-medium text-textMuted hover:text-white transition-colors"
          >
            サインアウト
          </button>
        </div>
      </nav>

      {/* Mobile: hamburger + sheet */}
      <div className="flex md:hidden items-center gap-3">
        <span className="text-sm text-textMuted truncate max-w-[100px]">{session.user.name}</span>
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger className="h-9 w-9 flex items-center justify-center rounded-md text-textMuted hover:text-white hover:bg-white/10 transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </SheetTrigger>
          <SheetContent side="right" className="w-64 bg-[#09090b] border-border/50">
            <SheetHeader>
              <SheetTitle className="text-left text-foreground">メニュー</SheetTitle>
            </SheetHeader>
            <div className="flex flex-col gap-1 mt-6">
              <NavLinks isAdmin={isAdmin} onClose={() => setOpen(false)} />
              <Separator className="my-4 bg-border/50" />
              <button
                onClick={() => signOut({ callbackUrl: "/login" })}
                className="text-sm font-medium text-textMuted hover:text-white transition-colors text-left"
              >
                サインアウト
              </button>
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </>
  );
}
