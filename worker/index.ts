import { app } from './app.ts';
import type { Env } from './env.ts';

/**
 * Honoアプリへ要求を渡す。テストとWorkersで同じルート・認証を使う。
 * @param request HTTP要求。
 * @param env D1と認証設定。
 * @returns Honoが生成したHTTP応答。
 */
export async function handleRequest(request: Request, env: Env = {}): Promise<Response> {
  return app.fetch(request, env);
}

export default app satisfies ExportedHandler<Env>;
