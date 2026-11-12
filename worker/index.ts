import { createAuth } from './auth/createAuth.ts';
import type { Env } from './env.ts';

/**
 * 公開の疎通確認、認証エンドポイント、ログイン後のAPIを振り分ける。
 * @param request クライアントからのリクエスト。
 * @param env D1バインディングと認証設定。
 * @returns 成功・認証エラー・未定義APIのJSON応答。
 */
export async function handleRequest(request: Request, env: Env = {}): Promise<Response> {
  const { pathname } = new URL(request.url);

  if (pathname === '/api/health') {
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      return Response.json(
        { error: 'Method not allowed' },
        { status: 405, headers: { Allow: 'GET, HEAD' } },
      );
    }

    return new Response(
      request.method === 'HEAD' ? null : JSON.stringify({ status: 'ok' }),
      { headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' } },
    );
  }

  try {
    const auth = createAuth(env);
    if (pathname.startsWith('/api/auth/')) {
      const response = await auth.handler(request);
      response.headers.set('Cache-Control', 'no-store');
      return response;
    }

    const session = await auth.api.getSession({ headers: request.headers });
    if (!session) {
      return Response.json({ error: 'ログインが必要です。' }, { status: 401, headers: { 'Cache-Control': 'no-store' } });
    }
    if (pathname === '/api/me' && request.method === 'GET') {
      return Response.json(
        { user: { id: session.user.id, name: session.user.name, email: session.user.email } },
        { headers: { 'Cache-Control': 'no-store' } },
      );
    }
    return Response.json({ error: 'Not found' }, { status: 404, headers: { 'Cache-Control': 'no-store' } });
  } catch {
    return Response.json({ error: '認証サービスを利用できません。設定をご確認ください。' }, {
      status: 503,
      headers: { 'Cache-Control': 'no-store' },
    });
  }
}

export default { fetch: handleRequest } satisfies ExportedHandler<Env>;
