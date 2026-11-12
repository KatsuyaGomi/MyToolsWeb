import type { createAuth } from './createAuth.ts';
import { readNewUser } from './adminApi.ts';
import type { Env } from '../env.ts';

/**
 * 初期設定トークンを比較用のSHA-256へ変換する。
 * @param token 一度限りの初期設定トークン。
 * @returns 16進数のハッシュ。
 */
export async function hashSetupToken(token: string) {
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token));
  return Buffer.from(hash).toString('hex');
}

/**
 * 一度限りのリンクを検証し、指定された所有者の管理者アカウントを作成する。
 * @param request トークン・名前・メール・初期パスワードの入力。
 * @param auth 認証インスタンス。
 * @param env D1と所有者メールの設定。
 * @returns 初期設定の成功または拒否応答。
 */
export async function handleSetup(request: Request, auth: ReturnType<typeof createAuth>, env: Env) {
  const headers = { 'Cache-Control': 'no-store' };
  if (request.method !== 'POST') return Response.json({ error: 'Method not allowed' }, { status: 405, headers: { ...headers, Allow: 'POST' } });
  if (request.headers.get('origin') !== new URL(env.BETTER_AUTH_URL!).origin) {
    return Response.json({ error: '許可されていないアクセス元です。' }, { status: 403, headers });
  }
  try {
    const body = await request.clone().json() as { token?: unknown };
    const input = await readNewUser(request);
    if (typeof body.token !== 'string' || body.token.length > 128 || !env.ADMIN_EMAIL
      || input.email !== env.ADMIN_EMAIL.trim().toLowerCase()) {
      return Response.json({ error: '初期設定リンクまたは入力内容を確認してください。' }, { status: 403, headers });
    }
    const hash = await hashSetupToken(body.token);
    const now = Date.now();
    const claimed = await env.DB!.prepare(
      'UPDATE "adminSetup" SET "usedAt" = ? WHERE "id" = 1 AND "tokenHash" = ? AND "expiresAt" > ? AND "usedAt" IS NULL RETURNING "id"',
    ).bind(now, hash, now).first<{ id: number }>();
    if (!claimed) return Response.json({ error: '初期設定リンクは無効、期限切れ、または使用済みです。' }, { status: 403, headers });
    try {
      await auth.api.createUser({ body: { ...input, role: 'admin' } });
    } catch {
      // 作成途中で失敗した場合はリンクを再試行可能にする。作成済みユーザーは上書きしない。
      await env.DB!.prepare('UPDATE "adminSetup" SET "usedAt" = NULL WHERE "id" = 1 AND "usedAt" = ?').bind(now).run();
      throw new Error('管理者の作成に失敗しました。');
    }
    return Response.json({ success: true }, { status: 201, headers });
  } catch {
    return Response.json({ error: '初期設定できませんでした。入力内容を確認してください。' }, { status: 400, headers });
  }
}
