# アプリ内認証

## 構成と実装状況

外部の認証サービスへ登録せず、Better AuthライブラリーをWorkers内で動かします。メールアドレスとパスワードでログインし、ユーザーとセッションはCloudflare D1へ保存します。Firebase・Cloudflare Accessは使用しません。

実装済み: 新規登録、ログイン、ログアウト、ログイン中の表示名、認証済みユーザーを返す `/api/me`、ローカルD1用マイグレーション。

2026年11月12日に、本番D1・秘密鍵・公開URLを設定し、認証テーブルの適用と公開サイトへのデプロイを完了しました。公開先は `wrangler.jsonc` の `BETTER_AUTH_URL` です。本番で登録・ログイン・ログアウトを確認済みです。

## 利用方法

- 初回は「アカウントを作成」から表示名・メールアドレス・パスワードを登録します。
- 別の端末でも同じメールアドレスとパスワードでログインすれば、同じユーザーIDを使用します。知人は自分のアカウントを作成します。
- パスワードは12〜128文字。平文は保存せず、ライブラリー標準のscryptでハッシュ化します。
- セッションはD1で管理し、HttpOnly・SameSite Cookieを使用します。本番HTTPSではSecure Cookieになります。ログアウトでセッションを失効させます。
- 外部メール送信サービスを使用しないため、メール確認とパスワード再設定メールは未対応です。登録アドレスの所有確認は行いません。
- 自己登録型です。メール許可リストや招待制は未導入です。利用者間のデータはユーザーIDで区別します。

## ローカル開発

`.dev.vars` に以下を設定します。このファイルはGit管理対象外です。

```dotenv
BETTER_AUTH_SECRET=<ランダムに生成した32文字以上の秘密鍵>
BETTER_AUTH_URL=http://127.0.0.1:5173
```

```sh
npx wrangler d1 migrations apply my-tools-web-db --local
npm run dev -- --port 5173 --strictPort
```

今回の初期設定ではローカル専用の秘密鍵と、ダミーのテストユーザーを作成済みです。本番へコピーしないでください。

## 別環境へ構築する場合の初回設定

1. `npx wrangler login` でCloudflareへログインします。
2. `npx wrangler d1 create my-tools-web-db` でDBを作成します。既存DBを使う場合は新規作成せず、そのDBを指定します。
3. 実際のDB IDを `wrangler.jsonc` の `d1_databases` に設定し、バインディング名を `DB` にします。現在の本番DB IDは設定済みです。DB ID自体は接続用の識別子で、APIトークンや秘密鍵ではありません。
4. `wrangler.jsonc` の `name` を公開中のWorker名と一致させます。現在の公開先は `my-tools-web` です。
5. WorkerのSecretsに、本番専用に生成した `BETTER_AUTH_SECRET` を設定します。ローカル用と別の値を使い、Gitやフロントエンドへ入れません。
6. Workerの変数 `BETTER_AUTH_URL` に、実際のHTTPS公開URLのオリジンを設定します。末尾にAPIパスを付けません。
7. `npx wrangler d1 migrations apply my-tools-web-db --remote` で本番へテーブルを作成します。
8. `npm run check` と `npm run build` を確認し、GitHubへプッシュして既存のCloudflareビルドからデプロイします。

秘密鍵はデプロイごとに再生成しません。変更すると既存セッション等に影響します。GitHub連携のデプロイ先が別の複製リポジトリーの場合は、変更を実際にビルドされるリポジトリーへ反映します。

通常の更新ではDBの再作成や秘密鍵の再設定は不要です。未適用のマイグレーションがある場合だけ対象環境へ適用します。プレビューURLは設定で無効にしています。

`/api/health` は個人情報を含まない公開の疎通確認APIです。それ以外の業務APIはサーバーでセッションを確認します。ログイン用のHTML・JS・CSSは公開されますが、個人データを静的ファイルへ埋め込みません。

## ユーザーごとのメモ・タスクを追加する際の規約

- 認証済みの `session.user.id` をデータ所有者のIDとして使います。画面が送信した `userId` を信用しません。
- メモ・タスクのテーブルには `userId` と必要な外部キー・インデックスを設けます。
- 取得・更新・削除のすべてで所有者をSQL条件に含めます。レコードIDが分かっても別の利用者は操作できないようにします。
- メールアドレスは変更される可能性があるため、データの所有者キーには使いません。
- UIで非表示にするだけでは分離になりません。ユーザーA・Bで相互のデータを操作できないことをAPI・D1で検証します。
- 現時点でメモ・タスク機能は未追加です。今回はユーザー識別とアクセス制御の基盤まで実装しています。

## 検証

`npm run check` は、登録、パスワード照合、平文パスワードの非保存、セッション失効、未認証アクセスの拒否、セッションに基づくユーザー識別、他オリジンからの拒否を検証します。Nodeの一時SQLiteを使用し、本番DBへ接続しません。

ローカルのWorkersランタイムとD1でも、登録→ログイン→認証API→ログアウト→同じセッションの拒否を確認します。本番公開後は、別端末と別アカウントでも確認してください。

## 参考資料

- [Better Auth: Cloudflareでの利用](https://better-auth.com/docs/guides/cloudflare)
- [Better Auth: メールとパスワード](https://better-auth.com/docs/authentication/email-password)
- [Better Auth: データベース](https://better-auth.com/docs/concepts/database)
