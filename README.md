# シフト管理アプリ

バイト・アルバイトのシフトを管理する Web アプリです。

## 構成

- **フロントエンド**: Next.js 15 + TypeScript（`frontend/`）
- **バックエンド**: Node.js + Express + Prisma（`backend/`）
- **DB**: PostgreSQL（192.168.100.2:5432）

## 機能

- **一般向け**: PC・スマートフォンで自分のシフトを確認
- **管理者向け**:
  - PC でシフトの作成・編集
  - ドラッグ＆ドロップでシフトを別の日に移動
  - 日ごとの最低出勤人数を設定し、不足時に警告を表示
- **将来**: 企業・団体別のマルチテナントと認証

## セットアップ

### 1. PostgreSQL

PostgreSQL が 192.168.100.2:5432 で起動していることを確認し、データベースを作成します。

```bash
createdb -h 192.168.100.2 -p 5432 -U postgres shift_manager
```

### 2. バックエンド

```bash
cd backend
cp .env.example .env
# .env の DATABASE_URL を編集（ユーザー名・パスワードを設定）
npm install
npx prisma generate
npx prisma db push
npm run dev
```

API は http://localhost:3001 で起動します。

### 3. フロントエンド

```bash
cd frontend
cp .env.local.example .env.local
# 必要なら NEXT_PUBLIC_API_URL を変更（デフォルトは http://localhost:3001）
npm install
npm run dev
```

ブラウザで http://localhost:3000 を開きます。

### 4. 初期データ（開発用）

組織とユーザーを作成しないと管理者画面でシフトを追加できません。API を直接叩くか、以下でシードできます。

```bash
# 組織を作成
curl -X POST http://localhost:3001/api/organizations -H "Content-Type: application/json" -d '{"name":"サンプル店"}'

# 返ってきた id を ORGANIZATION_ID に設定してユーザーを追加
curl -X POST http://localhost:3001/api/users -H "Content-Type: application/json" -d '{"organizationId":"ORGANIZATION_ID","email":"admin@example.com","name":"管理者","role":"ADMIN"}'
curl -X POST http://localhost:3001/api/users -H "Content-Type: application/json" -d '{"organizationId":"ORGANIZATION_ID","email":"member@example.com","name":"山田太郎","role":"MEMBER"}'
```

「自分のシフト」ページでは、ユーザー一覧 API で取得したユーザー ID を入力すると、そのユーザーのシフトを表示できます。

## スクリプト

| 場所       | コマンド        | 説明           |
|------------|-----------------|----------------|
| backend    | `npm run dev`   | API 開発サーバー |
| backend    | `npm run db:studio` | Prisma Studio |
| frontend   | `npm run dev`   | Next.js 開発サーバー |

## 認証について

現在は認証未実装です。組織 ID・ユーザー ID はクエリやローカルストレージで扱っています。  
将来的に NextAuth.js や Clerk 等でログインを入れ、組織・ユーザーをセッションから取得する想定です。
