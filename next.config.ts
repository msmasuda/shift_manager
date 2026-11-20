import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV !== "production";

// 外部リソースは使っていないので同一オリジンのみ許可する。
// Next.js のハイドレーション用インラインスクリプトと Tailwind/React の style 属性のため 'unsafe-inline' は外せない
// （外すには middleware で nonce を発行し、全ページを動的レンダリングにする必要がある）。
// 開発時は React Refresh が eval を、HMR が WebSocket を使う。
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  `connect-src 'self'${isDev ? " ws: wss:" : ""}`,
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  // upgrade-insecure-requests は付けない: LAN 内で http 配信すると同一オリジンの JS/CSS まで https に書き換わって壊れる
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()" },
  // HTTPS で配信する本番のみ。http://localhost に付けても無視されるが、誤って開発ドメインに残らないよう分ける
  ...(isDev ? [] : [{ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" }]),
];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
