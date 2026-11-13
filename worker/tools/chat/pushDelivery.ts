import { buildPushPayload } from '@block65/webcrypto-web-push';
import type { Env } from '../../env.ts';

interface Recipient {
  id: string;
  userId: string;
  endpoint: string;
  p256dh: string;
  auth: string;
}

/** @param env Worker設定。 @returns 通知の鍵が設定されているか。 */
export function pushConfigured(env: Env): boolean {
  return Boolean(env.VAPID_PUBLIC_KEY && env.VAPID_PRIVATE_KEY && env.VAPID_SUBJECT);
}

/**
 * 保存済みの通知ジョブを処理する。所属・ミュート・有効セッションを配信時にも確認する。
 * @param env 接続とVAPID鍵。
 * @param messageId 新規投稿。未指定なら再試行待ち1件。
 */
export async function deliverPush(env: Env, messageId?: number) {
  if (!pushConfigured(env) || !env.DB) return;
  const db = env.DB;
  const now = Date.now();
  const job = await db.prepare(`UPDATE chatPushJob SET attempts = attempts + 1, nextAttemptAt = ?
    WHERE messageId = (SELECT messageId FROM chatPushJob WHERE nextAttemptAt <= ? AND attempts < 10
      AND (? IS NULL OR messageId = ?) ORDER BY messageId LIMIT 1) RETURNING messageId`)
    .bind(now + 60_000, now, messageId ?? null, messageId ?? null).first<{ messageId: number }>();
  if (!job) return;
  const message = await db.prepare(`SELECT msg.*, r.groupId FROM chatMessage msg JOIN chatRoom r ON r.id = msg.roomId
    WHERE msg.id = ? AND msg.deletedAt IS NULL AND EXISTS(SELECT 1 FROM groupMembership WHERE userId = msg.authorId AND groupId = r.groupId)`)
    .bind(job.messageId).first<{ id: number; body: string; authorId: string; authorName: string; roomId: string; groupId: string }>();
  if (!message) {
    await db.prepare('DELETE FROM chatPushJob WHERE messageId = ?').bind(job.messageId).run();
    return;
  }
  const recipients = await db.prepare(`SELECT d.id, d.userId, d.endpoint, d.p256dh, d.auth FROM chatDevice d
    JOIN groupMembership m ON m.userId = d.userId AND m.groupId = ?
    JOIN session s ON s.id = d.sessionId AND s.userId = d.userId AND s.expiresAt > ?
    WHERE d.userId != ? AND d.createdAt <= (SELECT createdAt FROM chatMessage WHERE id = ?)
      AND NOT EXISTS(SELECT 1 FROM chatMute WHERE roomId = ? AND userId = d.userId AND muted = 1)
      AND NOT EXISTS(SELECT 1 FROM chatPushReceipt WHERE messageId = ? AND deviceId = d.id)
      AND NOT(coalesce(d.activeRoomId, '') = ? AND d.activeUntil > ?) LIMIT 3`)
    .bind(message.groupId, now, message.authorId, message.id, message.roomId, message.id, message.roomId, now).all<Recipient>();
  let failed = false;
  // 失敗した購読だけを次回へ残すため、ジョブ単位の送信記録で重複通知を防ぐ。
  for (const device of recipients.results) {
    try {
      const payload = await buildPushPayload({
        data: JSON.stringify({ title: message.authorName, body: message.body.slice(0, 600), roomId: message.roomId,
          messageId: message.id, deviceId: device.id, userId: device.userId }),
        options: { ttl: 300 },
      }, { endpoint: device.endpoint, expirationTime: null, keys: { p256dh: device.p256dh, auth: device.auth } }, {
        subject: env.VAPID_SUBJECT!, publicKey: env.VAPID_PUBLIC_KEY!, privateKey: env.VAPID_PRIVATE_KEY!,
      });
      const response = await fetch(device.endpoint, { ...payload, redirect: 'error', signal: AbortSignal.timeout(6000) });
      if (response.status === 404 || response.status === 410) {
        await db.prepare('DELETE FROM chatDevice WHERE id = ?').bind(device.id).run();
      } else if (!response.ok) failed = true;
      else await db.prepare('INSERT OR IGNORE INTO chatPushReceipt(messageId,deviceId) VALUES(?,?)').bind(message.id, device.id).run();
    } catch { failed = true; }
  }
  if (!failed && recipients.results.length < 3) {
    await db.batch([
      db.prepare('DELETE FROM chatPushJob WHERE messageId = ?').bind(message.id),
      db.prepare('DELETE FROM chatPushReceipt WHERE messageId = ?').bind(message.id),
    ]);
  }
}
