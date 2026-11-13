import { app } from './app.ts';
import type { Env } from './env.ts';
import { deliverPush } from './tools/chat/pushDelivery.ts';

/**
 * Honoアプリへ要求を渡す。テストとWorkersで同じルート・認証を使う。
 * @param request HTTP要求。
 * @param env D1と認証設定。
 * @returns Honoが生成したHTTP応答。
 */
export async function handleRequest(request: Request, env: Env = {}): Promise<Response> {
  return app.fetch(request, env);
}

export default {
  fetch: app.fetch,
  /** @param _controller 定期実行情報。 @param env 接続と通知鍵。 @param context 実行Context。通知失敗をCronで再試行する。 */
  scheduled(_controller, env, context) {
    context.waitUntil(deliverPush(env));
  },
} satisfies ExportedHandler<Env>;
