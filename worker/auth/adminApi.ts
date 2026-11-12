import type { createAuth } from './createAuth.ts';
import type { Env } from '../env.ts';

type Auth = ReturnType<typeof createAuth>;
type Session = NonNullable<Awaited<ReturnType<Auth['api']['getSession']>>>;

/**
 * DB上の管理者ロールと管理者専用メールの両方を確認する。
 * @param session 検証済みセッション。
 * @param env 管理者メールの設定。
 * @returns 所有者本人の管理者アカウントなら真。
 */
export function isOwnerAdmin(session: Session, env: Env) {
  return session.user.role === 'admin' && !!env.ADMIN_EMAIL
    && session.user.email.toLowerCase() === env.ADMIN_EMAIL.trim().toLowerCase();
}

/**
 * 管理者が入力した新規ユーザーの情報を検証する。
 * @param request アカウント作成リクエスト。
 * @returns 検証済みの名前・メール・パスワード。
 * @throws JSONや入力項目が無効な場合。
 */
export async function readNewUser(request: Request) {
  const body: unknown = await request.json();
  if (!body || typeof body !== 'object') throw new Error('入力が不正です。');
  const value = body as Record<string, unknown>;
  if (typeof value.name !== 'string' || typeof value.email !== 'string' || typeof value.password !== 'string') {
    throw new Error('必須項目を入力してください。');
  }
  const name = value.name.trim();
  const email = value.email.trim().toLowerCase();
  const password = value.password;
  if (!name || name.length > 60 || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
    || password.length < 12 || password.length > 128) throw new Error('名前・メール・12文字以上のパスワードを確認してください。');
  return { name, email, password };
}

/**
 * 所有者の管理者だけにユーザー一覧と一般アカウント作成を提供する。
 * @param request 管理APIのリクエスト。
 * @param auth 認証インスタンス。
 * @param session 検証済みセッション。
 * @param env 管理者メールの設定。
 * @returns ユーザー一覧、作成結果、または拒否応答。
 */
export async function handleAdminUsers(request: Request, auth: Auth, session: Session, env: Env) {
  const headers = { 'Cache-Control': 'no-store' };
  if (!isOwnerAdmin(session, env)) return Response.json({ error: '管理者のみ利用できます。' }, { status: 403, headers });
  if (request.method === 'GET') {
    const result = await auth.api.listUsers({ headers: request.headers, query: { limit: 100, sortBy: 'createdAt', sortDirection: 'desc' } });
    return Response.json({ users: result.users.map(publicUser), total: result.total }, { headers });
  }
  if (request.method !== 'POST') return Response.json({ error: 'Method not allowed' }, { status: 405, headers: { ...headers, Allow: 'GET, POST' } });
  if (request.headers.get('origin') !== new URL(env.BETTER_AUTH_URL!).origin) {
    return Response.json({ error: '許可されていないアクセス元です。' }, { status: 403, headers });
  }
  try {
    const input = await readNewUser(request);
    const result = await auth.api.createUser({ headers: request.headers, body: { ...input, role: 'user' } });
    return Response.json({ user: publicUser(result.user) }, { status: 201, headers });
  } catch {
    return Response.json({ error: '作成できませんでした。入力内容とメールアドレスの重複を確認してください。' }, { status: 400, headers });
  }
}

/**
 * セッションやパスワードを含まない一覧用の情報へ変換する。
 * @param user DB上のユーザー情報。
 * @returns 一覧に表示する項目。
 */
function publicUser(user: { id: string; name: string; email: string; role?: string | null }) {
  return { id: user.id, name: user.name, email: user.email, role: user.role ?? 'user' };
}
