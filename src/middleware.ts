import NextAuth from "next-auth";
import { authConfig } from "@/auth.config";
import { NextResponse } from "next/server";

const { auth } = NextAuth(authConfig);

export default auth((req) => {
  const { pathname } = req.nextUrl;

  if (!req.auth) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.redirect(new URL("/login", req.url));
  }

  const role = req.auth.user?.role;
  // GET /api/users はメンバーも参照可、それ以外の /api/users と /admin は ADMIN 限定
  const isAdminRoute =
    pathname.startsWith("/admin") ||
    (pathname.startsWith("/api/users") && req.method !== "GET");
  if (isAdminRoute && role !== "ADMIN") {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    return NextResponse.redirect(new URL("/my-shifts", req.url));
  }
});

export const config = {
  matcher: ["/((?!login|_next/static|_next/image|favicon\\.ico|api/auth).*)"],
};
