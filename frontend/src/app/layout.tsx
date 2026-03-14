import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "シフト管理",
  description: "バイト・アルバイトのシフト管理アプリ",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      <body>
        <header style={{ borderBottom: "1px solid var(--border)", padding: "0.75rem 1rem" }}>
          <nav style={{ display: "flex", gap: "1rem", alignItems: "center" }}>
            <a href="/" style={{ fontWeight: 700, textDecoration: "none" }}>
              シフト管理
            </a>
            <a href="/my-shifts">自分のシフト</a>
            <a href="/admin">管理者</a>
          </nav>
        </header>
        <main style={{ padding: "1rem", minHeight: "calc(100vh - 52px)" }}>{children}</main>
      </body>
    </html>
  );
}
