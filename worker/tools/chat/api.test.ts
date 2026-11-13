import assert from 'node:assert/strict';
import { test } from 'bun:test';
import { Hono } from 'hono';
import { chatRoutes } from './api.ts';
import { chatFixture } from './fixture.test.ts';
import type { AppEnv, AuthSession } from '../../http/types.ts';

/** APIの入力、送信元、所属、既読、ミュートと未定義ルートを確認する。 */
async function validatesChatApi() {
  const { db, sqlite } = chatFixture();
  const application = new Hono<AppEnv>();
  application.use('*', /** @param context Context。 @param next 次の処理。認証確認済みのテストセッションを設定する。 */ async (context, next) => {
    const id = context.req.header('X-Test-User') ?? 'alice';
    context.set('session', { user: { id, name: id, email: `${id}@example.test`, role: 'user' }, session: { id: `session-${id}` } } as AuthSession);
    await next();
  });
  application.route('/api/chat', chatRoutes);
  /** @param path API。 @param method メソッド。 @param body 入力。 @param user 利用者。 @param origin 送信元。 @returns HTTP応答。 */
  function request(path: string, method = 'GET', body?: unknown, user = 'alice', origin = 'https://example.test') {
    return application.fetch(new Request(`https://example.test/api/chat${path}`, {
      method, headers: { Origin: origin, 'X-Test-User': user }, body: body === undefined ? undefined : JSON.stringify(body),
    }), { DB: db, BETTER_AUTH_URL: 'https://example.test' }, {
      /** @param promise 通知処理。鍵未設定のため副作用はない。 */
      waitUntil(promise: Promise<unknown>) { void promise; },
      /** テスト中は例外を上位へ伝える。 */
      passThroughOnException() {},
      props: {},
    });
  }
  try {
    assert.equal((await request('/rooms/room-a/messages', 'GET', undefined, 'carol')).status, 404);
    assert.equal((await request('/rooms/room-a/messages', 'POST', {}, 'alice', 'https://evil.test')).status, 403);
    for (const body of [{}, { body: '', clientId: 'valid-client-id-0001' }, { body: 'a'.repeat(2001), clientId: 'valid-client-id-0001' }]) {
      assert.equal((await request('/rooms/room-a/messages', 'POST', body)).status, 400);
    }
    assert.equal((await request('/rooms/room-a/messages', 'POST', { body: 'a'.repeat(17000) })).status, 413);
    const sent = await request('/rooms/room-a/messages', 'POST', { body: '日本語\n😊', clientId: 'valid-client-id-0001', authorId: 'bob' });
    assert.equal(sent.status, 201, await sent.clone().text());
    const message = (await sent.json<{ message: { id: number; authorId: string } }>()).message;
    assert.equal(message.authorId, 'alice');
    assert.equal((await request('/rooms/room-a/messages?since=-1')).status, 400);
    assert.equal((await request('/rooms/room-a/read', 'POST', { messageId: message.id }, 'bob')).status, 200);
    assert.equal((await request('/rooms/room-a/mute', 'PUT', { muted: true }, 'bob')).status, 200);
    assert.equal((await request('/rooms/room-a/mute', 'PUT', { muted: 1 })).status, 400);
    assert.equal((await request('/rooms', 'PATCH', {})).status, 405);
    assert.equal((await request('/unknown')).status, 404);
    assert.equal((await request('/device', 'POST', {})).status, 503, '鍵未設定時に登録しない');
  } finally { sqlite.close(); }
}
test('チャットAPI: 入力・送信元・所属・メソッド制限', validatesChatApi);
