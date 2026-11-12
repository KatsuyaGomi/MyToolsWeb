import { betterAuth } from 'better-auth';
import type { Env } from '../env.ts';

/**
 * D1を使うアプリ内認証を初期化する。設定不足の場合は起動させない。
 * @param env D1バインディングと認証用の環境変数。
 * @returns メール・パスワード認証とDB保存型セッションを扱うインスタンス。
 * @throws DB、秘密鍵、公開URLが未設定または無効な場合。
 */
export function createAuth(env: Env) {
  if (!env.DB || !env.BETTER_AUTH_SECRET || env.BETTER_AUTH_SECRET.length < 32 || !env.BETTER_AUTH_URL) {
    throw new Error('認証の接続設定が完了していません。');
  }
  const origin = new URL(env.BETTER_AUTH_URL).origin;
  const isLocal = ['localhost', '127.0.0.1', '[::1]'].includes(new URL(origin).hostname);
  if (!origin.startsWith('https://') && !isLocal) {
    throw new Error('本番の認証URLにはHTTPSが必要です。');
  }

  return betterAuth({
    appName: 'My Tools',
    database: env.DB,
    secret: env.BETTER_AUTH_SECRET,
    baseURL: origin,
    basePath: '/api/auth',
    trustedOrigins: [origin],
    emailAndPassword: { enabled: true, minPasswordLength: 12, maxPasswordLength: 128 },
    session: { expiresIn: 60 * 60 * 24 * 7, updateAge: 60 * 60 * 24 },
    rateLimit: { enabled: true, storage: 'database', window: 60, max: 30 },
    advanced: { ipAddress: { ipAddressHeaders: ['cf-connecting-ip'] } },
  });
}
