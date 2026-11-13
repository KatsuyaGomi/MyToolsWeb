# バックエンドとBun開発環境

APIフレームワークは **Hono**、認証は **Better Auth**、保存先は **Cloudflare D1** です。開発・パッケージ管理・テスト・ビルド・Wranglerの実行は **Bun 1.4.4** を使用します。

2026-11-13にHonoへの移行とBun開発環境への切り替えを行い、Bun版Wranglerで既存Workerへ公開しました。DBのマイグレーションやSecretsの変更はありません。

本番の実行環境はCloudflare Workersです。BunやNode.jsのサーバーを本番で常駐させる構成ではありません。Workersの `nodejs_compat` はBetter Auth等が使う互換APIの設定なので維持します。

## Honoの構成

| ファイル | 役割 |
| --- | --- |
| worker/index.ts | HonoアプリをWorkersの入口としてexport。テスト用のhandleRequestも同じappへ渡す |
| worker/app.ts | 公開health・登録禁止・初期設定・Better Authと非公開ルートの組み立て |
| worker/http/middleware.ts | キャッシュ禁止、認証初期化、セッション確認 |
| worker/http/privateRoutes.ts | 管理者用API・Todo・カレンダー・本人情報のHonoルート |
| worker/http/types.ts | BindingsとContext変数（auth/session）の型 |
| worker/tools/ | 各機能の入力検証、所有者の確認、D1アクセス |

処理順は「no-store → 公開ルート → 認証初期化 → 初期設定・ログイン関連 → セッション確認 → 業務API」です。ログイン画面に必要な認証APIへセッション確認をかけないようにします。公開の自己登録とBetter Auth管理APIは、認証初期化より前に403で拒否します。

業務APIを追加するときは `privateRoutes.ts` のサブルーターへ登録します。`context.get('session').user.id` を所有者にし、クライアントのuserIdは認可に使用しません。既存のツールハンドラーにはWeb標準のRequestをそのまま渡すため、URL・Cookie・本文は変わりません。

未定義APIはJSONの404、未ログインは401、認証設定の欠落は503にします。各APIの未対応メソッドの405、Todo・カレンダーの409や公開範囲の制御を維持しています。

## Bunの使い方

```sh
bun --version
bun install --frozen-lockfile
bun run dev
bun run check
bun run build
bun run preview
bun run wrangler --version
bun run deploy
```

`packageManager: bun@1.4.4` でバージョンを指定し、`bun.lock` だけを管理します。依存追加は `bun add` / `bun add --dev` を使用し、更新後にクリーン環境で `bun install --frozen-lockfile` を確認してください。npmのpackage-lock.jsonを再作成しないでください。

`bunfig.toml` の `[run] bun = true` により、Node向けのシバンを持つCLIもBunで実行します。`node:fs`・`node:path`等のimportはBun内蔵の互換APIであり、Node実行ファイルを呼ぶものではありません。型チェック用の `@types/node` もVite等のAPIの型として残します。

テストは `bun:test` と `bun:sqlite` を使い、メモリー上の一時DBで実行します。本番D1へ接続しません。開発サーバーはViteをBunで起動し、その中のCloudflare pluginがworkerdを使って実際のWorkers環境とローカルD1を再現します。

### Cloudflare開発ツールとのHTTP互換性

Bun内蔵のUndici互換fetchは、Miniflareが使うカスタムdispatcherに対応せず、開発サーバーの起動時に `ECONNREFUSED` となります。この構成では `scripts/bunHttpCompat.mjs` をVite・Wranglerの起動前に読み込み、CLIプロセスの `undici` モジュールを公式Undiciパッケージの実装に置き換えます。

対応範囲は開発CLIだけです。グローバルfetch、本番のWorker、node_modulesのファイルは変更しません。`undici` は開発依存として固定しています。この対応を通すため、Vite・Wranglerはpackage.jsonのスクリプト経由で実行してください。BunとMiniflareの互換性が改善されたら、開発・プレビュー・D1操作を確認したうえで対応を外せます。

### Workers Builds

- ビルドコマンド: `bun run build`
- デプロイコマンド: `bun run wrangler deploy`
- 依存インストール: `bun.lock` によりBunを自動選択。バージョンはpackageManagerに従う。

Cloudflareダッシュボードに保存済みのnpm/npxコマンドはリポジトリー変更だけでは書き換わらないため、上記へ揃えてください。DBスキーマ・Secretsの再作成は不要です。

## 参考資料

- [HonoのCloudflare Workers連携](https://hono.dev/docs/getting-started/cloudflare-workers)
- [Bunの実行設定](https://bun.sh/docs/runtime/bunfig)
- [Bunのモジュール解決とUndici互換実装](https://bun.sh/docs/runtime/module-resolution)
- [CloudflareのBun・Undici互換性に関するissue](https://github.com/cloudflare/workers-sdk/issues/15717)
- [Workers Buildsのバージョン・パッケージ管理設定](https://developers.cloudflare.com/workers/ci-cd/builds/build-image/)
