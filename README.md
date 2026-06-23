# シフト管理アプリ

バイト・アルバイトのシフトを管理する Web アプリです。

## 構成

- **フレームワーク**: Next.js 15 App Router + TypeScript
- **バックエンド**: Next.js Route Handlers（`src/app/api/`）— 別プロセス不要
- **DB**: PostgreSQL（デフォルト 192.168.100.2:5432）
- **ORM**: Prisma v7（`@prisma/adapter-pg` 経由）
- **認証**: Auth.js v5（Google OAuth + 開発用 Credentials プロバイダー）

## 機能

- **一般向け**: 自分のシフトを確認（`/my-shifts`）
- **管理者向け**:
  - シフトの作成・編集（`/admin`）
  - ドラッグ＆ドロップで別の日に移動
  - 日ごとの最低出勤人数を設定し、不足時に警告を表示
- **認証**: Google アカウントでサインイン（事前登録制）

## セットアップ

### 1. 環境変数

```bash
cp .env.example .env
```

`.env` を編集して以下を設定します:

| 変数 | 説明 |
|------|------|
| `DATABASE_URL` | PostgreSQL 接続 URL |
| `AUTH_SECRET` | JWT 署名用シークレット（`openssl rand -base64 32` で生成） |
| `AUTH_GOOGLE_ID` | Google OAuth クライアント ID（本番用・任意） |
| `AUTH_GOOGLE_SECRET` | Google OAuth クライアントシークレット（本番用・任意） |

### 2. DB のセットアップ

PostgreSQL が起動していることを確認して:

```bash
npm install
npx prisma db push   # スキーマを DB に適用
npx prisma db seed   # 初期データを投入（任意）
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

### 開発時のログイン（Google OAuth 不要）

`AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET` が未設定でも、開発環境では `/login` にメールアドレス入力フォームが表示されます。DB に登録済みのメールアドレスを入力するとログインできます。

### ユーザーの事前登録

管理者ユーザーを最初に登録するには、DB に直接挿入するか Prisma Studio（`npx prisma studio`）を使用します。または開発時は seed で登録できます:

```bash
npx prisma db seed
```

### 本番環境での Google OAuth 設定

**Google OAuth を設定する前に本番デプロイすると、開発用 Credentials プロバイダーは無効になるため誰もログインできなくなります。** 本番デプロイと同時に以下を設定してください。

1. [Google Cloud Console](https://console.cloud.google.com/) で OAuth 2.0 クライアントを作成
2. 承認済みリダイレクト URI に追加:
   ```
   https://あなたのドメイン/api/auth/callback/google
   ```
3. 本番の環境変数に設定:
   ```
   AUTH_SECRET=<本番用に openssl rand -base64 32 で別途生成>
   AUTH_GOOGLE_ID=<クライアント ID>
   AUTH_GOOGLE_SECRET=<クライアントシークレット>
   ```

> `AUTH_SECRET` はローカル開発と異なる値を使用することを推奨します（ローカル発行の JWT を本番で流用できなくなるため）。

## スクリプト

| コマンド | 説明 |
|----------|------|
| `npm run dev` | 開発サーバー起動（:3000） |
| `npm run build` | 本番ビルド |
| `npm run lint` | ESLint |
| `npm test` | ユニットテスト（Vitest） |
| `npx prisma studio` | Prisma Studio（DB GUI） |
| `npx prisma db push` | スキーマを DB に適用 |
| `npx prisma db seed` | 開発用シードデータ投入 |
