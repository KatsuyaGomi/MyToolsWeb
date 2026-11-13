import { HTTPException } from 'hono/http-exception';
import type { ChatActor } from './access.ts';

/** @param endpoint 未検証の送信先。 @returns ブラウザー標準の配信先か。 */
export function validPushEndpoint(endpoint: unknown): endpoint is string {
  if (typeof endpoint !== 'string' || endpoint.length > 2048) return false;
  try {
    const url = new URL(endpoint);
    if (url.protocol !== 'https:' || url.username || url.password || url.port || url.hash) return false;
    return url.hostname === 'fcm.googleapis.com' || url.hostname.endsWith('.push.apple.com') ||
      url.hostname.endsWith('.push.services.mozilla.com') || url.hostname.endsWith('.notify.windows.com');
  } catch {
    return false;
  }
}

/** @param value 文字列。 @param size 復号後のバイト数。 @returns 有効なbase64url鍵か。 */
function validKey(value: unknown, size: number): value is string {
  if (typeof value !== 'string' || !/^[\w-]+$/.test(value)) return false;
  try { return atob(value.replaceAll('-', '+').replaceAll('_', '/')).length === size; }
  catch { return false; }
}

/**
 * 端末の購読を現在のセッションへ紐付ける。同じブラウザーのアカウント切替は明示的に再登録する。
 * @param db 接続。
 * @param actor 本人。
 * @param body ブラウザーの購読情報。
 * @throws 送信先や鍵が不正、端末数超過。
 */
export async function saveDevice(db: D1Database, actor: ChatActor, body: Record<string, unknown>) {
  const sub = body.subscription as { endpoint?: unknown; keys?: { p256dh?: unknown; auth?: unknown } } | undefined;
  if (typeof body.id !== 'string' || !/^[\w-]{16,64}$/.test(body.id) || !validPushEndpoint(sub?.endpoint) ||
      !validKey(sub?.keys?.p256dh, 65) || !validKey(sub.keys.auth, 16)) {
    throw new HTTPException(400, { message: '通知の購読情報が不正です。' });
  }
  const total = await db.prepare('SELECT count(*) AS total FROM chatDevice WHERE userId = ? AND id != ?').bind(actor.id, body.id).first<{ total: number }>();
  if ((total?.total ?? 0) >= 5) throw new HTTPException(400, { message: '通知は1ユーザー5端末までです。不要な端末の通知を解除してください。' });
  // endpointと端末IDはブラウザーが保持する能力トークン。別アカウントへの切替で古い購読を残さない。
  await db.batch([
    db.prepare('DELETE FROM chatDevice WHERE endpoint = ? OR id = ?').bind(sub.endpoint, body.id),
    db.prepare('INSERT INTO chatDevice(id,userId,sessionId,endpoint,p256dh,auth,createdAt) VALUES(?,?,?,?,?,?,?)')
      .bind(body.id, actor.id, actor.sessionId, sub.endpoint, sub.keys.p256dh, sub.keys.auth, Date.now()),
  ]);
}

/** @param db 接続。 @param userId 本人。 @param deviceId 端末。 @param roomId 表示中の部屋。nullは非表示。閲覧中の通知を抑制する。 */
export async function touchDevice(db: D1Database, userId: string, deviceId: string, roomId: string | null) {
  await db.prepare('UPDATE chatDevice SET activeRoomId = ?, activeUntil = ? WHERE id = ? AND userId = ?')
    .bind(roomId, roomId ? Date.now() + 8000 : 0, deviceId, userId).run();
}

/** @param db 接続。 @param actor 本人と現在のセッション。 @param id 端末ID。 @returns このセッションの有効な購読か。 */
export async function hasDevice(db: D1Database, actor: ChatActor, id: string): Promise<boolean> {
  const device = await db.prepare('SELECT id FROM chatDevice WHERE id = ? AND userId = ? AND sessionId = ?')
    .bind(id, actor.id, actor.sessionId).first();
  return Boolean(device);
}

/** @param db 接続。 @param userId 本人。 @param id 端末ID。本人の購読だけを解除する。 */
export async function removeDevice(db: D1Database, userId: string, id: string) {
  await db.prepare('DELETE FROM chatDevice WHERE id = ? AND userId = ?').bind(id, userId).run();
}

/** @param db 接続。 @param userId 本人。 @param id 端末ID。 @param roomId 閉じた部屋。遅い終了要求が新しい部屋の状態を消すことを防ぐ。 */
export async function clearPresence(db: D1Database, userId: string, id: string, roomId: string) {
  await db.prepare('UPDATE chatDevice SET activeRoomId = NULL, activeUntil = 0 WHERE id = ? AND userId = ? AND activeRoomId = ?')
    .bind(id, userId, roomId).run();
}
