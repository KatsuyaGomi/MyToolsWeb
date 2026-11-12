import type { TodoBoard } from '../../../shared/todo.ts';

interface BoardRow { revision: number; content: string }

/**
 * ユーザーの初期ボードを用意し、D1から取得する。同時初回アクセスでも上書きしない。
 * @param db D1接続。
 * @param userId セッションで確認した所有者ID。
 * @returns 保存済みボード。
 */
export async function readBoard(db: D1Database, userId: string): Promise<TodoBoard> {
  const existing = await db.prepare('SELECT revision, content FROM todoBoard WHERE userId = ?').bind(userId).first<BoardRow>();
  if (existing) return { ...JSON.parse(existing.content), revision: existing.revision };
  const initial: Omit<TodoBoard, 'revision'> = {
    statuses: [
      { id: crypto.randomUUID(), name: '未着手', color: 'gray' },
      { id: crypto.randomUUID(), name: '進行中', color: 'blue' },
      { id: crypto.randomUUID(), name: '完了', color: 'green' },
    ],
    tasks: [],
  };
  await db.prepare('INSERT OR IGNORE INTO todoBoard (userId, content) VALUES (?, ?)')
    .bind(userId, JSON.stringify(initial)).run();
  const row = await db.prepare('SELECT revision, content FROM todoBoard WHERE userId = ?').bind(userId).first<BoardRow>();
  if (!row) throw new Error('ボードを取得できません。');
  return { ...JSON.parse(row.content), revision: row.revision };
}

/**
 * 所有者と版番号が一致するときだけ、ボード全体を単一SQLで置換する。
 * @param db D1接続。
 * @param userId セッションで確認した所有者ID。
 * @param board 検証済みボード。
 * @returns 保存結果。別端末による更新と競合した場合はnull。
 */
export async function writeBoard(db: D1Database, userId: string, board: TodoBoard): Promise<TodoBoard | null> {
  const content = JSON.stringify({ statuses: board.statuses, tasks: board.tasks });
  const row = await db.prepare(`UPDATE todoBoard SET content = ?, revision = revision + 1,
    updatedAt = CURRENT_TIMESTAMP WHERE userId = ? AND revision = ? RETURNING revision`)
    .bind(content, userId, board.revision).first<{ revision: number }>();
  return row ? { ...board, revision: row.revision } : null;
}
