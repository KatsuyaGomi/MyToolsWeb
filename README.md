# My Tools

自分用のWebツールを少しずつ追加していくための、Cloudflare Workers向けアプリです。
React + TypeScript + Viteで画面を作り、Cloudflare Vite pluginを通じてWorkersのAPIと静的アセットをまとめてビルドします。

現在はTailwind CSSのダークテーマによるホーム画面（空状態・検索・カテゴリー）、共通サイドメニュー、疎通確認APIを用意しています。個別ツールはまだ登録していません。モバイルではヘッダーのボタンからメニューを開閉できます。

## 開発を始める

Node.js 22.12以降（推奨24 LTS）とnpmを使用します。

```sh
npm ci
npm run dev
```

ターミナルに表示されたローカルURLを開きます。`/api/health` は `{"status":"ok"}` を返します。

```sh
npm run check       # TypeScriptの型チェック + APIのNode単体テスト
npm run build       # 本番用ビルド
npm run preview     # ビルド済みアプリをローカルのWorkersランタイムで確認
```

`npm run build` は `scripts/cleanBuild.mjs` で前回の `dist/` を削除してからビルドします。Windowsのこの開発環境で再帰的な一括削除が異常終了したため、ファイルを順番に削除する方法にしています。生成物以外は削除しません。

## ディレクトリー

```text
src/
  App.tsx               共通レイアウトとページの組み立て
  main.tsx              Reactの起動
  app/
    layouts/            ヘッダー・サイドメニュー・共通枠
    pages/              ホーム画面とツール一覧
    router/             URLとページの対応、未定義URLの案内
  shared/components/    共通アイコンなどのUI部品
  styles/theme.css      Tailwind読み込みとダークテーマの共通色
  tools/
    registry.ts         実装済みツールの一覧
worker/
  index.ts              /api/* のリクエスト処理
  index.test.ts         APIの単体テスト
AGENTS.md               AI開発の方針と作業手順
vite.config.ts          フロントエンドとWorkersのビルド連携
wrangler.jsonc          Cloudflare Workersの設定
```

## ツールを追加する

1. `src/tools/<tool-id>/` に画面と処理を作成する。
2. `src/app/router/AppRoutes.tsx` に専用URLと画面の対応を実装する。現在は通常のリンクで遷移し、専用のルーターライブラリーは未導入。
3. `src/tools/registry.ts` に `id`、`name`、`description`、`href`、`category` を登録する。共通サイドメニューとホームの一覧に反映される。
4. サーバーが必要な場合は `worker/` に処理を追加し、`/api/*` で提供する。
5. `npm run check` と `npm run build` を実行する。

データの保存先は未導入です。ブラウザーだけで完結する処理を優先し、端末内保存ならlocalStorage/IndexedDB、端末間共有が必要ならD1などを要件に合わせて検討します。

## Cloudflareへデプロイする

この初期構築ではCloudflareアカウントへの変更やデプロイは行いません。
公開時は、まず `wrangler.jsonc` の `name` を確認してください。

```sh
npx wrangler login
npm run deploy
```

デプロイ先URLはWranglerが表示します。独自ドメイン、Cloudflare Access、D1等のバインディングは未設定です。

**現状は認証がありません。** 自分だけが利用する場合は、機密データを扱う前にCloudflare Access等で画面とAPIの両方を保護してください。Cloudflare Accessを利用する場合は、設定したドメインに加えてworkers.devやプレビューURLから迂回できないことも確認します。

## 環境変数・シークレット

現在必須の環境変数はありません。今後のWorker用シークレットはローカルでは `.dev.vars` に記載し、本番では `npx wrangler secret put <NAME>` で設定します。`.dev.vars*` と `.env*` はGitから除外しています。`VITE_*` の値はブラウザーへ公開されるため秘密情報を入れないでください。

## AIで開発する

ルートの [AGENTS.md](./AGENTS.md) を開発ガイドとして使用します。依頼例:

> AGENTS.mdに従って、ブラウザー内で完結するJSON整形ツールを追加してください。入力エラーを表示し、ツール一覧から開けるようにしてください。

## 公式ドキュメント

- [Cloudflare: React SPAとAPIの構築](https://developers.cloudflare.com/workers/vite-plugin/tutorial/)
- [Cloudflare: 静的アセット](https://developers.cloudflare.com/workers/static-assets/)
- [Cloudflare: AccessとWorkers](https://developers.cloudflare.com/workers/configuration/access/)
