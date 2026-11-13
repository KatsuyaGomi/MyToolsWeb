import type { ChatMessage } from '../../../shared/chat.ts';
import { memberSql } from './access.ts';
import type { ChatActor } from './access.ts';

/**
 * 本人の新規投稿を原子的に保存する。clientIdで再送を重複させない。
 * @param db 接続。
 * @param roomId 部屋。
 * @param actor 投稿者。
 * @param body 本文。
 * @param clientId クライアントで発行した再送識別子。
 * @returns 新規・既存の投稿。操作を拒否した場合はnull。
 */
export async function createMessage(db: D1Database, roomId: string, actor: ChatActor, body: string, clientId: string) {
  const previous = await db.prepare(`SELECT * FROM chatMessage WHERE authorId = ? AND clientId = ? AND roomId = ? AND ${memberSql}`)
    .bind(actor.id, clientId, roomId, roomId, actor.id).first<ChatMessage>();
  if (previous) return previous;
  const mutationId = crypto.randomUUID();
  const now = Date.now();
  const guard = 'EXISTS(SELECT 1 FROM chatRoom WHERE id = ? AND mutationId = ?)';
  const result = await db.batch([
    db.prepare(`UPDATE chatRoom SET version = version + 1, mutationId = ? WHERE id = ? AND ${memberSql}
      AND NOT EXISTS(SELECT 1 FROM chatMessage WHERE authorId = ? AND createdAt > ?) RETURNING version`)
      .bind(mutationId, roomId, roomId, actor.id, actor.id, now - 1000),
    db.prepare(`INSERT INTO chatMessage(roomId, authorId, authorName, clientId, body, changeId, createdAt)
      SELECT ?, ?, ?, ?, ?, version, ? FROM chatRoom WHERE id = ? AND mutationId = ? RETURNING *`)
      .bind(roomId, actor.id, actor.name, clientId, body, now, roomId, mutationId),
    db.prepare(`INSERT OR IGNORE INTO chatPushJob(messageId) SELECT id FROM chatMessage
      WHERE authorId = ? AND clientId = ? AND ${guard}`).bind(actor.id, clientId, roomId, mutationId),
  ]);
  return result[1].results[0] as ChatMessage | undefined ?? null;
}

/**
 * 投稿者のみ編集でき、削除は投稿者または管理者本人が行える。本文は削除時に消去する。
 * @param db 接続。
 * @param roomId 部屋。
 * @param actor 操作者。
 * @param id 投稿ID。
 * @param revision 編集開始時の版。
 * @param body 新しい本文。nullは削除。
 * @returns 成功200、権限なし404、競合409。
 */
export async function changeMessage(db: D1Database, roomId: string, actor: ChatActor, id: number, revision: number, body: string | null) {
  const canAdminDelete = body === null && actor.isAdmin;
  const mutationId = crypto.randomUUID();
  const permission = '(authorId = ? OR ? = 1)';
  const result = await db.batch([
    db.prepare(`UPDATE chatRoom SET version = version + 1, mutationId = ? WHERE id = ? AND ${memberSql}
      AND EXISTS(SELECT 1 FROM chatMessage WHERE id = ? AND roomId = ? AND revision = ? AND deletedAt IS NULL AND ${permission}) RETURNING version`)
      .bind(mutationId, roomId, roomId, actor.id, id, roomId, revision, actor.id, Number(canAdminDelete)),
    db.prepare(`UPDATE chatMessage SET body = ?, revision = revision + 1,
      changeId = (SELECT version FROM chatRoom WHERE id = ?), editedAt = ?, deletedAt = ?
      WHERE id = ? AND roomId = ? AND EXISTS(SELECT 1 FROM chatRoom WHERE id = ? AND mutationId = ?) RETURNING id`)
      .bind(body ?? '', roomId, body === null ? null : Date.now(), body === null ? Date.now() : null, id, roomId, roomId, mutationId),
  ]);
  if (result[1].results.length) return 200;
  const existing = await db.prepare(`SELECT id FROM chatMessage WHERE id = ? AND roomId = ? AND ${permission} AND ${memberSql}`)
    .bind(id, roomId, actor.id, Number(canAdminDelete), roomId, actor.id).first();
  return existing ? 409 : 404;
}
