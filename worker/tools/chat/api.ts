import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import type { ContentfulStatusCode } from 'hono/utils/http-status';
import type { AppEnv } from '../../http/types.ts';
import { isOwnerAdmin } from '../../auth/adminApi.ts';
import { accessibleRoom, chatActor } from './access.ts';
import { listRooms, markRead, readMessages, setRoomMute } from './queries.ts';
import { changeMessage, createMessage } from './mutations.ts';
import { integer, messageBody, readChatBody } from './input.ts';
import { deliverPush, pushConfigured } from './pushDelivery.ts';
import { clearPresence, hasDevice, removeDevice, saveDevice, touchDevice } from './pushDevices.ts';

export const chatRoutes = new Hono<AppEnv>();
chatRoutes.onError(/** @param error 例外。 @param context 現在のContext。 @returns 入力またはサービスエラー。 */ (error, context) => {
  const status = error instanceof HTTPException ? error.status : 503;
  return context.json({ error: error instanceof HTTPException ? error.message : 'チャットを利用できません。時間をおいて再試行してください。' }, status as ContentfulStatusCode);
});
chatRoutes.use('*', /** @param context Context。 @param next 次の処理。変更操作の送信元を確認する。 */ async (context, next) => {
  if (context.req.method !== 'GET' && context.req.raw.headers.get('Origin') !== new URL(context.env.BETTER_AUTH_URL!).origin) {
    throw new HTTPException(403, { message: '送信元が一致しません。' });
  }
  await next();
});
chatRoutes.get('/rooms', /** @param context Context。 @returns 所属先の部屋と自分の情報。 */ async (context) => {
  const session = context.get('session');
  return context.json({ rooms: await listRooms(context.env.DB!, session.user.id),
    me: { id: session.user.id, name: session.user.name }, isAdmin: isOwnerAdmin(session, context.env),
    pushKey: pushConfigured(context.env) ? context.env.VAPID_PUBLIC_KEY : null });
});
chatRoutes.use('/rooms/:roomId/*', /** @param context Context。 @param next 次の処理。所属を毎回確認する。 */ async (context, next) => {
  if (!await accessibleRoom(context.env.DB!, context.req.param('roomId')!, context.get('session').user.id)) {
    throw new HTTPException(404, { message: '部屋が見つからないか、所属から外れています。' });
  }
  await next();
});
chatRoutes.get('/rooms/:roomId/messages', /** @param context Context。 @returns 履歴・差分・既読者。 */ async (context) => {
  const userId = context.get('session').user.id;
  const roomId = context.req.param('roomId');
  const since = context.req.query('since');
  const before = context.req.query('before');
  const snapshot = await readMessages(context.env.DB!, roomId, userId, {
    since: since === undefined ? undefined : integer(since), before: before === undefined ? undefined : integer(before),
  });
  if (!snapshot) throw new HTTPException(404, { message: '所属が変更されました。部屋を選び直してください。' });
  const device = context.req.query('device');
  if (device) await touchDevice(context.env.DB!, userId, device, roomId);
  return context.json(snapshot);
});
chatRoutes.post('/rooms/:roomId/messages', /** @param context Context。 @returns 保存した投稿。 */ async (context) => {
  const body = await readChatBody(context.req.raw);
  if (typeof body.clientId !== 'string' || !/^[\w-]{16,64}$/.test(body.clientId)) throw new HTTPException(400, { message: '再送IDが不正です。' });
  const actor = chatActor(context.get('session'), isOwnerAdmin(context.get('session'), context.env));
  const message = await createMessage(context.env.DB!, context.req.param('roomId'), actor, messageBody(body.body), body.clientId);
  if (!message) throw new HTTPException(429, { message: '連続送信は1秒以上空けてください。所属変更時は再読み込みしてください。' });
  context.executionCtx.waitUntil(deliverPush(context.env, message.id).catch(/** 通知は再試行ジョブに残し、本文はログに出さない。 */ () => console.warn('チャット通知の処理を次回へ延期しました。')));
  return context.json({ message }, 201);
});
chatRoutes.on(['PUT', 'DELETE'], '/rooms/:roomId/messages/:id', /** @param context Context。 @returns 編集・削除結果。 */ async (context) => {
  const body = await readChatBody(context.req.raw);
  const actor = chatActor(context.get('session'), isOwnerAdmin(context.get('session'), context.env));
  const status = await changeMessage(context.env.DB!, context.req.param('roomId'), actor, integer(context.req.param('id')),
    integer(body.revision), context.req.method === 'DELETE' ? null : messageBody(body.body));
  if (status !== 200) throw new HTTPException(status, { message: status === 409 ? '投稿が更新されています。再読み込みして操作してください。' : 'この投稿は変更できません。' });
  return context.json({ ok: true });
});
chatRoutes.post('/rooms/:roomId/read', /** @param context Context。 @returns 既読の保存結果。 */ async (context) => {
  const body = await readChatBody(context.req.raw);
  await markRead(context.env.DB!, context.req.param('roomId'), context.get('session').user.id, integer(body.messageId));
  return context.json({ ok: true });
});
chatRoutes.put('/rooms/:roomId/mute', /** @param context Context。 @returns ミュートの保存結果。 */ async (context) => {
  const body = await readChatBody(context.req.raw);
  if (typeof body.muted !== 'boolean') throw new HTTPException(400, { message: '設定が不正です。' });
  await setRoomMute(context.env.DB!, context.req.param('roomId'), context.get('session').user.id, body.muted);
  return context.json({ ok: true });
});
chatRoutes.get('/device', /** @param context Context。 @returns このセッションで通知を登録しているか。 */ async (context) => {
  const session = context.get('session');
  const device = await hasDevice(context.env.DB!, chatActor(session, false), context.req.query('id') ?? '');
  const roomId = context.req.query('room');
  const allowed = !roomId || await accessibleRoom(context.env.DB!, roomId, session.user.id);
  return context.json({ enabled: Boolean(device && allowed), userId: session.user.id });
});
chatRoutes.post('/device', /** @param context Context。 @returns 通知購読の保存結果。 */ async (context) => {
  if (!pushConfigured(context.env)) throw new HTTPException(503, { message: '通知用の鍵が未設定です。' });
  await saveDevice(context.env.DB!, chatActor(context.get('session'), false), await readChatBody(context.req.raw));
  return context.json({ ok: true });
});
chatRoutes.delete('/device', /** @param context Context。 @returns 端末の通知解除結果。 */ async (context) => {
  const body = await readChatBody(context.req.raw);
  await removeDevice(context.env.DB!, context.get('session').user.id, String(body.id));
  return context.json({ ok: true });
});
chatRoutes.post('/presence', /** @param context Context。 @returns 非表示状態の保存結果。 */ async (context) => {
  const body = await readChatBody(context.req.raw);
  await clearPresence(context.env.DB!, context.get('session').user.id, String(body.id), String(body.roomId));
  return context.json({ ok: true });
});
chatRoutes.all('*', /** @param context Context。 @returns 未対応メソッドは405、未知のパスは404。 */ (context) => {
  const path = context.req.path.replace(/^\/api\/chat/, '');
  const known = /^\/(rooms|device|presence)$/.test(path) || /^\/rooms\/[\w-]+\/(messages(?:\/\d+)?|read|mute)$/.test(path);
  return context.json({ error: '対応していない操作です。' }, known ? 405 : 404);
});
