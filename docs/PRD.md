# 製品要件定義書 (PRD): App Feedback Management System (AFMS) v2.0

## 1. はじめに

### 1.1 背景

現在、複数の自社スマホアプリを運用しているが、フィードバック収集手段が分散しており、定量的な管理や迅速な改善サイクルへの反映が困難である。

### 1.2 目的・ゴール

- **収集の統一:** スマホアプリから直接 API 経由でデータを DB(D1)へ蓄積する。
- **責務の分離:** アプリ連携用 API（安定性重視）と管理画面（機能追加重視）を物理的に分離し、保守性と安全性を高める。
- **一元管理:** 複数のアプリのフィードバックを単一の管理画面で効率的に処理する。

## 2. システム構成・アーキテクチャ

**Monorepo（モノレポ）構成**を採用し、データ定義（Schema）を共有しつつ、デプロイ単位を分離します。

### 2.1 全体像

- **Repository:** Turborepo（Better T Stack / `bun create better-t-stack` で初期化）による Monorepo。
- **Package Manager:** Bun。
- **Database:** Cloudflare D1 (SQLite)。API と管理画面の双方からアクセスする単一のデータソース。

### 2.2 コンポーネント定義

| コンポーネント | 役割                                                  | デプロイ先             | 技術スタック                                   | 認証方式                   |
| :------------- | :---------------------------------------------------- | :--------------------- | :--------------------------------------------- | :------------------------- |
| **Public API** | スマホアプリからのデータ受信、バリデーション、DB 保存 | **Cloudflare Workers** | Hono, Drizzle ORM (`packages/db`)              | **API Key** (Header)       |
| **Admin Web**  | フィードバック閲覧、ステータス管理、アプリ設定        | **Cloudflare Workers** | Next.js (App Router), Better Auth, Drizzle ORM | **Session/OAuth** (Cookie) |
| **Shared Lib** | DB スキーマ共有、型定義、共通ユーティリティ           | (Build time only)      | TypeScript, Drizzle (`packages/db`), Auth Lib  | -                          |

### 2.3 採用理由（分離構成）

1.  **安定性の確保:** 管理画面の頻繁なアップデートや UI バグが、スマホアプリからのデータ受信（API）に影響を与えないようにするため。
2.  **パフォーマンス:** API 側は Hono + Workers の組み合わせにより、コールドスタートほぼゼロの超低遅延レスポンスを実現する。
3.  **DX（開発体験）:** Drizzle ORM のスキーマをパッケージとして共有することで、API と管理画面の間で型定義の二重管理を防ぐ。

---

## 3. ディレクトリ構造イメージ

開発のベースとなる構造定義です。

```text
feedback-management-system/
├── package.json
├── turbo.json
├── packages/
│   ├── auth/            # 認証ヘルパー・型
│   ├── config/          # 共通設定 (tsconfig など)
│   └── db/              # Drizzle スキーマと DB ユーティリティ
├── apps/
│   ├── server/          # Public API (Hono on Workers)
│   │   └── src/index.ts
│   └── web/             # Admin Dashboard (Next.js on Workers)
│       ├── app/         # Next.js App Router
│       ├── lib/         # Better Auth など
│       └── next.config.ts
```

---

## 4. 機能要件

### 4.1 スマホアプリ連携用 API (`apps/server`)

Hono で実装される軽量 API サービスです。

- **エンドポイント:** `POST /api/v1/feedback`
- **ミドルウェア:**
  - **API Key 認証:** ヘッダーの `X-App-Api-Key` を検証し、登録済みアプリ（Apps テーブル）からのリクエストか確認。
  - **Rate Limiting:** アプリ単位または IP 単位での過剰なアクセスを制限（Cloudflare Rate Limiting 推奨）。
  - **Validation:** `zod` バリデータによる入力値チェック。
- **処理フロー:**
  1.  Request 受信
  2.  API Key 検証
  3.  Body バリデーション
4.  D1 へ Insert（`packages/db` のスキーマ利用）
  5.  201 Created 返却

### 4.2 管理画面 (`apps/web`)

Next.js で実装される運営用ダッシュボードです。

#### A. 認証機能 (Better Auth)

- **管理者ログイン:** Email/Password または GitHub/Google アカウントでの SSO。
- **セッション管理:** セキュアな Cookie ベースのセッション管理。

#### B. アプリ管理 (Projects)

- **アプリ登録:** 新規アプリ名の登録。
- **API Key 管理:**
  - API Key の発行（UUID またはハッシュ化可能なトークン）。
  - Key の表示（作成時のみ表示し、以降は非表示にする等のセキュリティ対策）。

#### C. フィードバック運用 (Dashboard)

- **Inbox ビュー:** 未対応のフィードバックを一覧表示。
- **フィルタリング:** アプリ別、バージョン別、OS 別、評価（星の数）別。
- **詳細ビュー:** ユーザーのデバイス情報（JSON）を整形して表示。
- **アクション:** ステータス変更（Open -> In Progress -> Resolved / Ignored）。

---

## 5. データモデル (Drizzle ORM Schema)

`packages/db/src/schema` に定義し、API と Web の両方から import します。

### 5.1 Apps (Projects)

```typescript
export const apps = sqliteTable("apps", {
  id: text("id").primaryKey(), // cuid2 or uuid
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  apiKey: text("api_key").notNull(), // 運用負荷軽減のため今回は平文保存を想定(要件次第でハッシュ化)
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  ownerId: text("owner_id").references(() => users.id), // 作成者
});
```

### 5.2 Feedbacks

```typescript
export const feedbacks = sqliteTable("feedbacks", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  appId: text("app_id")
    .references(() => apps.id)
    .notNull(),
  // ユーザー情報
  userId: text("user_id"), // アプリ側のユーザー識別子
  // 内容
  rating: integer("rating"), // 1-5
  category: text("category"), // 'bug', 'feature', 'general', 'ui/ux'
  content: text("content"),
  // 環境情報 (JSON)
  deviceInfo: text("device_info", { mode: "json" }),
  metadata: text("metadata", { mode: "json" }),
  // 管理ステータス
  status: text("status").default("pending"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
});
```

### 5.3 Users (Better Auth)

Better Auth の標準スキーマを使用（User, Session, Account, Verification 等）。

---

## 6. 非機能要件

- **スケーラビリティ:**
  - API (Workers) は自動スケーリングされるため、急激なトラフィック増（キャンペーン等）にも対応可能。
  - D1 は現在ベータを抜けており、商用利用に十分な性能を持つが、Write 頻度が極端に高い場合はバッチインサート等の最適化を検討する。
- **セキュリティ:**
  - **CORS:** API は全オリジン許可（モバイルアプリからのアクセス用）、または特定のヘッダー必須化で制御。
  - **Input Sanitization:** Hono の Zod Validator で不正な入力を DB に入れる前に弾く。
- **型安全性:**
  - Monorepo 全体で TypeScript を使用。
  - Client(App) -> API(Hono) -> DB(Drizzle) -> Admin(Next.js) まで型を一貫させる。
- **コード品質:**
  - **Biome:** リンターおよびフォーマッターとして Biome を採用し、高速かつ統一されたコードスタイルを維持する。

---

## 7. 開発・デプロイフロー

### 7.1 ローカル開発

- `wrangler d1 create` でローカル D1 を作成。
- `bun run dev` (Turbo) で API(Port 8787) と Web(Port 3000) を同時起動。
- API リクエストは `http://localhost:8787`、管理画面は `http://localhost:3000` で確認。

### 7.2 デプロイ (Cloudflare)

- **CI/CD:** GitHub Actions 等を利用。
- **Apps/API:** `apps/server` ディレクトリで `wrangler deploy` を実行。Workers としてデプロイ。
- **Apps/Web:** `apps/web` をビルドし、Workers ランタイムでデプロイ（Next.js on Workers）。
- **DB Migration:** スキーマ変更時は `drizzle-kit migrate` を実行して D1 へ適用。

---

## 8. ロードマップ

### Phase 1: 基盤構築 (MVP)

- Monorepo 環境のセットアップ。
- D1 データベース作成と Drizzle スキーマ定義。
- `apps/server`: データ受信機能のみ実装。
- `apps/web`: ログイン機能(Better Auth)とシンプルなリスト表示。

### Phase 2: 管理機能強化

- アプリ（プロジェクト）の追加・編集機能。
- API Key の発行・再生成 UI。
- フィードバックのステータス管理（未読/既読/完了）。

### Phase 3: 分析・高度化

- Slack / Teams 通知連携（API 側で Hono のバックグラウンドタスクを利用）。
- ダッシュボードでの統計表示（OS シェア、評価推移グラフ）。
- Workers AI を用いた「フィードバックの要約」「感情分析」機能の追加。
