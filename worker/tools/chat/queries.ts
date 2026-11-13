import type { ChatMessage, ChatReader, ChatRoom, ChatSnapshot } from '../../../shared/chat.ts';
import { accessibleRoom, memberSql } from './access.ts';

/** @param db 接続。 @param userId 所有者。 @returns 所属先の部屋と未読件数。 */
export async function listRooms(db: D1Database, userId: string): Promise<ChatRoom[]> {
  await db.prepare(`INSERT OR IGNORE INTO chatRoom(id, groupId)
    SELECT lower(hex(randomblob(16))), groupId FROM groupMembership WHERE userId = ?`).bind(userId).run();
  const rows = await db.prepare(`SELECT r.id, g.name,
    (SELECT count(*) FROM chatMessage msg WHERE msg.roomId = r.id AND msg.deletedAt IS NULL AND coalesce(msg.authorId, '') != ?
      AND msg.id > coalesce((SELECT lastReadId FROM chatRead WHERE roomId = r.id AND userId = ?), 0)) AS unread,
    coalesce((SELECT muted FROM chatMute WHERE roomId = r.id AND userId = ?), 0) AS muted
    FROM chatRoom r JOIN userGroup g ON g.id = r.groupId
    JOIN groupMembership m ON m.groupId = r.groupId WHERE m.userId = ? ORDER BY g.name LIMIT 30`)
    .bind(userId, userId, userId, userId).all<ChatRoom>();
  return rows.results.map(/** @param room 保存行。 @returns 真偽値を整えた部屋。 */ (room) => ({ ...room, muted: Boolean(room.muted) }));
}

/**
 * 初回・履歴は50件、差分は最大201件を取得する。編集・削除も差分に含む。
 * @param db 接続。
 * @param roomId 対象の部屋。
 * @param userId 閲覧者。
 * @param options 履歴ページまたは差分のカーソル。
 * @returns 閲覧可能なスナップショット。所属解除ならnull。
 */
export async function readMessages(db: D1Database, roomId: string, userId: string,
  options: { since?: number; before?: number }): Promise<ChatSnapshot | null> {
  if (!await accessibleRoom(db, roomId, userId)) return null;
  const incremental = options.since !== undefined;
  const condition = incremental ? 'changeId > ?' : 'id < ?';
  const limit = incremental ? 201 : 51;
  const result = await db.batch([
    db.prepare(`SELECT version FROM chatRoom WHERE id = ? AND ${memberSql}`).bind(roomId, roomId, userId),
    db.prepare(`SELECT * FROM chatMessage WHERE roomId = ? AND ${condition} AND ${memberSql}
      ORDER BY ${incremental ? 'changeId ASC' : 'id DESC'} LIMIT ?`)
      .bind(roomId, options.since ?? options.before ?? Number.MAX_SAFE_INTEGER, roomId, userId, limit),
    db.prepare(`SELECT u.id, u.name, coalesce(rd.lastReadId, 0) AS lastReadId FROM chatRoom room
      JOIN groupMembership m ON m.groupId = room.groupId JOIN "user" u ON u.id = m.userId
      LEFT JOIN chatRead rd ON rd.roomId = room.id AND rd.userId = u.id
      WHERE room.id = ? AND ${memberSql} ORDER BY u.name LIMIT 100`).bind(roomId, roomId, userId),
  ]);
  const state = result[0].results[0] as { version: number } | undefined;
  if (!state) return null;
  let messages = result[1].results as ChatMessage[];
  const hasMore = messages.length === limit;
  if (!incremental) messages = messages.slice(0, 50).reverse();
  // 差分が多い場合も取りこぼさず、次の取得で残りを読む。
  const version = incremental && hasMore ? messages[messages.length - 1].changeId : state.version;
  return { messages, version, hasMore, readers: result[2].results as ChatReader[] };
}

/** @param db 接続。 @param roomId 部屋。 @param userId 本人。 @param id 表示済みの最終ID。既読を後退させず保存する。 */
export async function markRead(db: D1Database, roomId: string, userId: string, id: number) {
  await db.prepare(`INSERT INTO chatRead(roomId, userId, lastReadId)
    SELECT ?, ?, ? WHERE ${memberSql} AND EXISTS(SELECT 1 FROM chatMessage WHERE id = ? AND roomId = ?)
    ON CONFLICT(roomId,userId) DO UPDATE SET lastReadId = max(chatRead.lastReadId, excluded.lastReadId)`)
    .bind(roomId, userId, id, roomId, userId, id, roomId).run();
}

/** @param db 接続。 @param roomId 部屋。 @param userId 本人。 @param muted 通知を抑止するか。現在の所属先だけ設定する。 */
export async function setRoomMute(db: D1Database, roomId: string, userId: string, muted: boolean) {
  await db.prepare(`INSERT INTO chatMute(roomId,userId,muted) SELECT ?,?,? WHERE ${memberSql}
    ON CONFLICT(roomId,userId) DO UPDATE SET muted = excluded.muted`)
    .bind(roomId, userId, Number(muted), roomId, userId).run();
}
