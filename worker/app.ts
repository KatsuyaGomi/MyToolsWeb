import { Hono } from 'hono';
import { handleSetup } from './auth/setupApi.ts';
import { initializeAuth, preventCache } from './http/middleware.ts';
import { privateRoutes } from './http/privateRoutes.ts';
import type { AppEnv } from './http/types.ts';

export const app = new Hono<AppEnv>();
app.use('*', preventCache);

app.onError(/**
 * 内部の例外や秘密情報を応答へ出さず、キャッシュ禁止の503にする。
 * @param _error 発生した例外。本文や個人情報をログへ出力しない。
 * @param context 現在のContext。
 * @returns 設定・サービス障害の応答。
 */ (_error, context) => {
  context.header('Cache-Control', 'no-store');
  return context.json({ error: '認証サービスを利用できません。設定をご確認ください。' }, 503);
});

app.all('/api/auth/sign-up/email', /**
 * 認証設定の有無にかかわらず公開の自己登録を拒否する。
 * @param context 現在のContext。
 * @returns 登録禁止の応答。
 */ (context) => context.json({ error: '公開のアカウント作成は無効です。' }, 403));

app.all('/api/auth/admin/*', /**
 * Better Authの直接の管理APIを公開しない。
 * @param context 現在のContext。
 * @returns 管理APIの直接アクセス禁止。
 */ (context) => context.json({ error: '公開のアカウント作成は無効です。' }, 403));

app.get('/api/health', /**
 * 認証設定に依存しない疎通確認を返す。HEADの本文はHonoが除去する。
 * @param context 現在のContext。
 * @returns 正常状態のJSON。
 */ (context) => context.json({ status: 'ok' }));

app.all('/api/health', /**
 * 疎通確認の未対応メソッドを明示する。
 * @param context 現在のContext。
 * @returns 許可メソッド付きの405。
 */ (context) => {
  context.header('Allow', 'GET, HEAD');
  return context.json({ error: 'Method not allowed' }, 405);
});

app.use('*', initializeAuth);

app.all('/api/setup', /**
 * 期限・一回限りの初期管理者設定を認証ライブラリーへ委譲する。
 * @param context 認証を初期化したContext。
 * @returns 初期設定APIの応答。
 */ (context) => handleSetup(context.req.raw, context.get('auth'), context.env));

app.all('/api/auth/*', /**
 * URL・本文・Cookieを変更せずBetter Authの標準ハンドラーへ渡す。
 * @param context 認証を初期化したContext。
 * @returns 認証APIの応答。
 */ (context) => context.get('auth').handler(context.req.raw));

app.route('/api', privateRoutes);
app.notFound(/**
 * 未定義APIをHTMLへフォールバックさせない。
 * @param context 現在のContext。
 * @returns JSONの404。
 */ (context) => context.json({ error: 'Not found' }, 404));
