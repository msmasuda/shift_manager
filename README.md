# シフト管理アプリ

バイト・アルバイトのシフトを管理する Web アプリです。

## 本番環境

**URL**: https://shift-manager-five-ashy.vercel.app

### デモ用ログイン情報

シードデータとして以下のアカウントが登録済みです（パスワードは共通）。

| 組織 | メールアドレス | ロール |
|------|--------------|--------|
| サンプルカフェ | `yamada@cafe.example.com` | 管理者 |
| サンプルカフェ | `sato@cafe.example.com` | メンバー |
| サンプルカフェ | `suzuki@cafe.example.com` | メンバー |
| サンプルベーカリー | `nakamura@bakery.example.com` | 管理者 |
| サンプルベーカリー | `kobayashi@bakery.example.com` | メンバー |

**共通パスワード**: `password123`

## 構成

- **フレームワーク**: Next.js 15 App Router + TypeScript
- **バックエンド**: Next.js Route Handlers（`src/app/api/`）— 別プロセス不要
- **DB**: ローカル: PostgreSQL（Docker）／ 本番: Vercel Postgres
- **ORM**: Prisma v7（`@prisma/adapter-pg` 経由）
- **認証**: Auth.js v5（メール＋パスワード認証、Google OAuth はオプション）
- **ホスティング**: Vercel

## 機能

### 管理者向け（`/admin`）
- シフトの作成・編集・削除
- ドラッグ＆ドロップで別の日にシフトを移動
- 日ごとの最低出勤人数を設定し、不足時に警告を表示
- 営業時間カバレッジチェック
- 希望休・有給の管理
- シフト一覧の Excel エクスポート
- 組織設定（`/admin/organization`）

### 一般向け
- 自分のシフトを確認（`/my-shifts`）
- 月次スケジュール閲覧（`/schedule`）

### 認証
- メールアドレス＋パスワードでログイン（事前登録制）
- Google OAuth（`AUTH_GOOGLE_ID` を設定した場合のみ有効）

## ローカル開発セットアップ

### 1. 環境変数

```bash
cp .env.example .env
```

`.env` を編集して以下を設定します:

| 変数 | 説明 |
|------|------|
| `DATABASE_URL` | PostgreSQL 接続 URL |
| `AUTH_SECRET` | JWT 署名用シークレット（`openssl rand -base64 32` で生成） |
| `AUTH_GOOGLE_ID` | Google OAuth クライアント ID（任意） |
| `AUTH_GOOGLE_SECRET` | Google OAuth クライアントシークレット（任意） |

### 2. DB の起動とセットアップ

```bash
docker-compose up -d       # PostgreSQL を起動
npm install
npx prisma db push         # スキーマを DB に適用
npx prisma db seed         # 開発用シードデータを投入
```

### 3. 開発サーバーの起動

```bash
npm run dev
```

ブラウザで http://localhost:3000 を開きます。

## 認証

### 仕組み

- **事前登録制**: DB に登録済みのメールアドレスのみサインイン可能
- **セッション**: JWT 方式（DB にセッションを保存しない）
- **ロール**: `ADMIN`（管理者）/ `MEMBER`（一般）をセッションに含める

### Google OAuth の追加設定（任意）

`AUTH_GOOGLE_ID` を設定した場合、Google アカウントでもログイン可能になります。

1. [Google Cloud Console](https://console.cloud.google.com/) で OAuth 2.0 クライアントを作成
2. 承認済みリダイレクト URI に追加:
   ```
   https://あなたのドメイン/api/auth/callback/google
   ```
3. 環境変数に設定:
   ```
   AUTH_GOOGLE_ID=<クライアント ID>
   AUTH_GOOGLE_SECRET=<クライアントシークレット>
   ```

## 本番デプロイ（Vercel）

### 必要な環境変数

| 変数 | 説明 |
|------|------|
| `DATABASE_URL` | Vercel Postgres の接続 URL（Storage 連携で自動設定） |
| `AUTH_SECRET` | `openssl rand -base64 32` で生成 |

### DB の初期化

```bash
DATABASE_URL="<本番の接続URL>" npx prisma db push
DATABASE_URL="<本番の接続URL>" npx prisma db seed
```

## スクリプト

| コマンド | 説明 |
|----------|------|
| `npm run dev` | 開発サーバー起動（:3000） |
| `npm run build` | 本番ビルド |
| `npm run lint` | ESLint |
| `npm test` | ユニットテスト（Vitest） |
| `npm run test:e2e` | E2E テスト（Playwright） |
| `npx prisma studio` | Prisma Studio（DB GUI） |
| `npx prisma db push` | スキーマを DB に適用 |
| `npx prisma db seed` | 開発用シードデータ投入 |
