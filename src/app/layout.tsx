import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";
import { NavAuth } from "./nav-auth";

const inter = Inter({ subsets: ["latin"], display: 'swap' });

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
    <html lang="ja" className={inter.className}>
      <body className="flex flex-col min-h-screen">
        <Providers>
          <header className="fixed top-0 w-full z-50 px-6 py-4">
            <div className="max-w-6xl mx-auto glass-card px-6 py-3 flex items-center justify-between">
              <a href="/" className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-accent to-purple-400 no-underline hover:opacity-80 transition-opacity">
                ShiftManager
              </a>
              <nav className="flex gap-6 items-center">
                <a href="/my-shifts" className="text-sm font-medium text-textMuted hover:text-white transition-colors">
                  自分のシフト
                </a>
                <a href="/admin" className="text-sm font-medium text-textMuted hover:text-white transition-colors">
                  管理者
                </a>
                <NavAuth />
              </nav>
            </div>
          </header>
          {/* top padding accounts for fixed header */}
          <main className="flex-1 w-full max-w-6xl mx-auto px-6 pt-32 pb-12 animate-fade-in relative z-10">
            {children}
          </main>
        </Providers>
      </body>
    </html>
  );
}
