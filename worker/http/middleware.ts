import type { MiddlewareHandler } from 'hono';
import { createAuth } from '../auth/createAuth.ts';
import type { AppEnv } from './types.ts';

/**
 * 成功・失敗を問わずAPI応答のキャッシュを禁止する。
 * @param context HonoのリクエストContext。
 * @param next 次のミドルウェア。
 */
export const preventCache: MiddlewareHandler<AppEnv> = async (context, next) => {
  context.header('Cache-Control', 'no-store');
  await next();
  context.header('Cache-Control', 'no-store');
};

/**
 * リクエストごとの認証インスタンスを用意する。公開のhealth・登録禁止ルートには適用しない。
 * @param context Bindingsを持つContext。
 * @param next 次の認証・API処理。
 */
export const initializeAuth: MiddlewareHandler<AppEnv> = async (context, next) => {
  context.set('auth', createAuth(context.env));
  await next();
};

/**
 * セッションを確認し、以降の全ツールAPIへ検証済みの所有者を渡す。
 * @param context 認証インスタンスを持つContext。
 * @param next ログイン後のAPI処理。
 * @returns 未ログインなら401。
 */
export const requireSession: MiddlewareHandler<AppEnv> = async (context, next) => {
  const session = await context.get('auth').api.getSession({ headers: context.req.raw.headers });
  if (!session) return context.json({ error: 'ログインが必要です。' }, 401);
  context.set('session', session);
  await next();
};
