import type { CalendarEvent, CalendarInput, CalendarScope } from '../../../shared/calendar.ts';

interface EventRow extends CalendarInput {
  id: string;
  revision: number;
  userId: string;
  ownerName: string;
}

/**
 * 本人の予定と、共通グループに所属する登録者のPublic予定をDB側で絞り込む。
 * @param db D1接続。
 * @param userId セッションのユーザーID。
 * @param range 半開区間の期間と表示範囲。
 * @returns メールアドレス・内部の所有者IDを含まない予定一覧。
 */
export async function listEvents(db: D1Database, userId: string, range: { from: string; to: string; scope: CalendarScope }): Promise<CalendarEvent[]> {
  const result = await db.prepare(`SELECT e.*, u.name AS ownerName FROM calendarEvent e
    JOIN "user" u ON u.id = e.userId
    WHERE e.startAt < ? AND e.endAt > ? AND
      (e.userId = ? OR (? = 'public' AND e.visibility = 'public' AND EXISTS (
        SELECT 1 FROM groupMembership author
        JOIN groupMembership viewer ON viewer.groupId = author.groupId
        WHERE author.userId = e.userId AND viewer.userId = ?)))
    ORDER BY e.startAt, e.endAt, e.id LIMIT 501`)
    .bind(range.to, range.from, userId, range.scope, userId).all<EventRow>();
  return result.results.map(/** @param row 保存行。 @returns 閲覧用データ。 */ (row) => ({
    id: row.id, title: row.title, description: row.description, startAt: row.startAt,
    endAt: row.endAt, visibility: row.visibility, revision: row.revision,
    ownerName: row.ownerName, isOwner: row.userId === userId,
  }));
}

/**
 * 作成者をセッションのユーザーに固定して予定を登録する。
 * @param db D1接続。
 * @param userId 認証済み作成者。
 * @param input 検証済み入力。
 * @returns 新しいID。
 */
export async function createEvent(db: D1Database, userId: string, input: CalendarInput): Promise<string> {
  const id = crypto.randomUUID();
  await db.prepare(`INSERT INTO calendarEvent
    (id, userId, title, description, startAt, endAt, visibility) VALUES (?, ?, ?, ?, ?, ?, ?)`)
    .bind(id, userId, input.title, input.description, input.startAt, input.endAt, input.visibility).run();
  return id;
}

/**
 * 所有者と版番号を条件に編集・削除する。他人の予定はPublicでも変更できない。
 * @param db D1接続。
 * @param userId セッションの所有者。
 * @param id 対象ID。
 * @param revision 編集開始時の版番号。
 * @param input 更新内容。nullなら削除。
 * @returns 成功200、存在しないか権限なし404、競合409。
 */
export async function changeEvent(db: D1Database, userId: string, id: string, revision: number, input: CalendarInput | null): Promise<number> {
  const statement = input
    ? db.prepare(`UPDATE calendarEvent SET title = ?, description = ?, startAt = ?, endAt = ?, visibility = ?,
        revision = revision + 1, updatedAt = CURRENT_TIMESTAMP WHERE id = ? AND userId = ? AND revision = ? RETURNING id`)
      .bind(input.title, input.description, input.startAt, input.endAt, input.visibility, id, userId, revision)
    : db.prepare('DELETE FROM calendarEvent WHERE id = ? AND userId = ? AND revision = ? RETURNING id')
      .bind(id, userId, revision);
  if (await statement.first()) return 200;
  const owned = await db.prepare('SELECT id FROM calendarEvent WHERE id = ? AND userId = ?').bind(id, userId).first();
  return owned ? 409 : 404;
}
