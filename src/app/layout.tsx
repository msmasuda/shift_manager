import type { Metadata } from "next";
import "./globals.css";
import Link from "next/link";
import { Providers } from "./providers";
import { NavAuth } from "./nav-auth";

export const metadata: Metadata = {
  title: "シフト管理",
  description: "モダンなバイト・アルバイトのシフト管理アプリ",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja" className="font-sans dark">
      <body className="flex flex-col min-h-screen">
        <Providers>
          <header className="fixed top-0 w-full z-50 px-6 py-4">
            <div className="max-w-6xl mx-auto glass-card px-6 py-3 flex items-center justify-between">
              <Link href="/" className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-accent to-purple-400 no-underline hover:opacity-80 transition-opacity">
                ShiftManager
              </Link>
              <nav className="flex gap-6 items-center">
                <NavAuth />
              </nav>
            </div>
          </header>
          {/* top padding accounts for fixed header */}
          <main className="flex-1 w-full max-w-6xl mx-auto px-6 pt-32 pb-12 animate-fade-in">
            {children}
          </main>
        </Providers>
      </body>
    </html>
  );
}
