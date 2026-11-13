# My Tools

自分用のWebツールを少しずつ追加していくための、Cloudflare Workers向けアプリです。
React + TypeScript + Viteで画面を作り、APIはHono + Better Auth + D1で実装します。開発・テスト・ビルドにはBunを使い、Cloudflare Vite pluginを通じてWorkersのAPIと静的アセットをまとめてビルドします。

Tailwind CSSのダークテーマによるホーム画面、共通サイドメニュー、メールアドレス・パスワードによるアプリ内認証を用意しています。本番D1との接続と認証の公開は完了しています。[Todoカンバンボード](./docs/todo.md)と、Private/Publicの予定を管理する[カレンダー](./docs/calendar.md)を利用できます。

`codex/user-groups` ブランチでは、[グループ管理](./docs/groups.md)とPublic予定のグループ内共有を追加しています。この機能は本番未反映です。本番適用時はグループ用マイグレーションを先に適用してください。

## 開発を始める

Bun 1.4.4を使用します。`package.json` の `packageManager` でバージョンを固定しています。`bun --version` で確認してください。[公式のインストール手順](https://bun.sh/docs/installation)で導入できます。新しく導入した場合はターミナルを開き直してください。

`bun.lock` を正本とし、package-lock.jsonは使用しません。Bun内蔵のNode互換APIを使う箇所はありますが、開発コマンドはBunで実行します。本番はCloudflare Workersのランタイムで動作します。構成と互換性対応は[バックエンドの開発手順](./docs/backend.md)を参照してください。

```sh
bun install --frozen-lockfile
bun run dev
```

ターミナルに表示されたローカルURLを開きます。初回は [認証の設定手順](./docs/authentication.md) に従って `.dev.vars` とローカルD1を設定してください。`/api/health` は公開の疎通確認として `{"status":"ok"}` を返します。

```sh
bun run check       # TypeScriptの型チェック + APIのBun単体テスト
bun run build       # 本番用ビルド
bun run preview     # ビルド済みアプリをローカルのWorkersランタイムで確認
```

`bun run build` は `scripts/cleanBuild.mjs` で前回の `dist/` を削除してからビルドします。Windowsのこの開発環境で再帰的な一括削除が異常終了したため、ファイルを順番に削除する方法にしています。生成物以外は削除しません。

## ディレクトリー

```text
src/
  App.tsx               共通レイアウトとページの組み立て
  main.tsx              Reactの起動
  app/
    layouts/            ヘッダー・サイドメニュー・共通枠
    pages/              ホーム画面とツール一覧
    router/             URLとページの対応、未定義URLの案内
    auth/               ログイン・管理者のユーザー作成・初期管理者設定
  shared/components/    共通アイコンなどのUI部品
  styles/theme.css      Tailwind読み込みとダークテーマの共通色
  tools/
    registry.ts         実装済みツールの一覧
    todo/               個人用カンバンボード
    calendar/           Private/Public対応カレンダー
shared/todo.ts          フロントエンド・Worker共通のTodoデータ型
shared/calendar.ts      カレンダーの共通データ型・日時検証
worker/
  index.ts              Workersの入口（Honoアプリをexport）
  app.ts                Honoの公開API・認証ルートの定義
  http/                 共通ミドルウェア・ログイン後のルートと型
  index.test.ts         APIの単体テスト
  auth/                 Better Authの設定と認証テスト
  tools/todo/           Todo API・入力検証・D1保存
  tools/calendar/       カレンダーの閲覧制御・入力検証・D1保存
  env.ts                Workerの環境型
migrations/             D1認証テーブルのマイグレーション
AGENTS.md               AI開発の方針と作業手順
vite.config.ts          フロントエンドとWorkersのビルド連携
wrangler.jsonc          Cloudflare Workersの設定
```

## ツールを追加する

1. `src/tools/<tool-id>/` に画面と処理を作成する。
2. `src/app/router/AppRoutes.tsx` に専用URLと画面の対応を実装する。現在は通常のリンクで遷移し、専用のルーターライブラリーは未導入。
3. `src/tools/registry.ts` に `id`、`name`、`description`、`href`、`category` を登録する。共通サイドメニューとホームの一覧に反映される。
4. サーバーが必要な場合は `worker/tools/<tool-id>/` に処理を追加し、`worker/http/privateRoutes.ts` にHonoのルートを登録する。検証済みセッションを使い、`/api/*` で提供する。
5. `bun run check` と `bun run build` を実行する。

永続保存するアプリデータのDBには **Cloudflare D1** を使用します。ブラウザー内で完結する変換処理などは、そのままブラウザーで実行します。

## データベースの方針

データの保存・取得は `React → /api/* → Worker → D1` の経路で行います。Workerから `DB` バインディングでアクセスし、Cloudflareの認証情報をブラウザーへ渡しません。localStorage / IndexedDBは端末固有の表示設定や一時的な下書き等の補助用途に限定します。

認証用D1の接続設定と `migrations/0001_auth.sql` を用意し、ローカル・本番へ適用済みです。ツールの保存機能を追加する際は、既存DBを使用して必要なスキーマ変更を追加します。以下は新しい環境を構築する場合の手順です。

管理者用スキーマは `migrations/0002_admin.sql` で追加済みです。DBを直接確認する手順は [D1操作ガイド](./docs/d1.md) を参照してください。

1. D1のDBを作成し、`wrangler.jsonc` に `d1_databases` と `DB` バインディングを設定する。
2. Workerの環境型とツール単位のDBアクセス処理を実装する。
3. ルートの `migrations/` にスキーマ変更SQLを作成する。
4. ローカルD1へマイグレーションを適用し、保存・取得とエラー処理を確認する。
5. 公開時に認証・認可を整え、本番DBへのマイグレーションとWorkerのデプロイをそれぞれ実施する。

DB設定後のマイグレーション例です。`<database-name>` は設定したDB名へ置き換えます。

```sh
bun run wrangler d1 migrations create <database-name> <migration-name>
bun run wrangler d1 migrations apply <database-name> --local
```

本番へ適用する場合は、対象DBと影響を確認したうえで `--remote` を明示します。ローカルDBは本番DBとは別で、開発中の変更が自動で本番へ反映されることはありません。実データやDBエクスポートはGitへ追加しません。

## Cloudflareへデプロイする

公開先は `wrangler.jsonc` の `name`（`my-tools-web`）です。既存の本番D1とSecretsを使用して更新します。

```sh
bun run wrangler login
bun run deploy
```

デプロイ先URLはWranglerが表示します。認証の初回公開時は、先に [本番D1と認証の設定](./docs/authentication.md) を行ってください。

### GitHub連携のWorkers Builds

- ビルドコマンド: `bun run build`
- デプロイコマンド: `bun run wrangler deploy`
- ルートディレクトリー: リポジトリーのルート
- Worker名: `wrangler.jsonc` の `name`（現在は `my-tools-web`）と一致させる

依存インストールはCloudflareが自動で実行します。`bun.lock` からBunを選び、`packageManager` の指定からBun 1.4.4を使用します。既存のビルド設定がnpm/npxのままの場合は、上記のBunコマンドへ変更してください。

ロックの不一致で停止する場合は、`bun install` で `package.json` と `bun.lock` を揃えます。既存の `node_modules` がない環境から `bun install --frozen-lockfile` と `bun run build` が通ることを確認してください。

テンプレートから作成する操作では、元のリポジトリーを別リポジトリーへ複製する場合があります。Cloudflare側でビルド対象のリポジトリー・ブランチを確認し、修正がそのリポジトリーへ反映されてから再ビルドしてください。

認証はWorkers内で動くBetter AuthとD1を使用します。FirebaseやCloudflare Accessは不要です。公開の新規登録は無効で、管理者本人だけが「アカウント管理」から一般ユーザーを作成します。初期管理者は一度限りのリンクでパスワードを設定します。メール確認・再設定メールは未対応です。詳細は [認証ガイド](./docs/authentication.md) を参照してください。

## 環境変数・シークレット

認証には `BETTER_AUTH_SECRET`、`BETTER_AUTH_URL`、管理者メールの `ADMIN_EMAIL` が必要です。ローカルでは `.dev.vars`、本番の秘密鍵と管理者メールはCloudflareのSecretsで設定します。`.dev.vars*` と `.env*` はGitから除外しています。`VITE_*` の値はブラウザーへ公開されるため秘密情報を入れないでください。

## AIで開発する

ルートの [AGENTS.md](./AGENTS.md) を開発ガイドとして使用します。依頼例:

> AGENTS.mdに従って、ブラウザー内で完結するJSON整形ツールを追加してください。入力エラーを表示し、ツール一覧から開けるようにしてください。

## 公式ドキュメント

- [Cloudflare: React SPAとAPIの構築](https://developers.cloudflare.com/workers/vite-plugin/tutorial/)
- [Cloudflare: 静的アセット](https://developers.cloudflare.com/workers/static-assets/)
- [Better Auth: Workersでの利用](https://better-auth.com/docs/guides/cloudflare)
- [Hono: Cloudflare Workers](https://hono.dev/docs/getting-started/cloudflare-workers)
- [Bun: 実行設定](https://bun.sh/docs/runtime/bunfig)
- [Cloudflare: Workers Buildsのパッケージ管理設定](https://developers.cloudflare.com/workers/ci-cd/builds/build-image/)
- [Cloudflare D1: はじめに](https://developers.cloudflare.com/d1/get-started/)
- [Cloudflare D1: マイグレーション](https://developers.cloudflare.com/d1/reference/migrations/)
