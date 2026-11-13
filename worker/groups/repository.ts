import type { GroupDirectory, GroupMembership, ManagedGroup, UserGroup } from '../../shared/groups.ts';

export type GroupChange =
  | { kind: 'create'; id: string; name: string }
  | { kind: 'rename'; id: string; name: string }
  | { kind: 'delete'; id: string }
  | { kind: 'membership'; userId: string; groupIds: string[] };

/** @param db D1接続。 @param userId 認証済みユーザー。 @returns 自分の所属先のみ。 */
export async function listMyGroups(db: D1Database, userId: string): Promise<UserGroup[]> {
  const rows = await db.prepare(`SELECT g.id, g.name FROM userGroup g JOIN groupMembership m ON m.groupId = g.id
    WHERE m.userId = ? ORDER BY g.name LIMIT 30`).bind(userId).all<UserGroup>();
  return rows.results;
}

/**
 * グループ・指定ユーザーの所属・版番号を同じスナップショットから読む。
 * @param db D1接続。
 * @param userIds 管理画面に表示する最大100人。
 * @returns 管理者用のグループ設定。
 */
export async function readDirectory(db: D1Database, userIds: string[]): Promise<GroupDirectory> {
  const placeholders = userIds.map(/** @returns バインド用のプレースホルダー。 */ () => '?').join(',');
  const membershipSql = userIds.length
    ? `SELECT userId, groupId FROM groupMembership WHERE userId IN (${placeholders}) ORDER BY userId, groupId`
    : 'SELECT userId, groupId FROM groupMembership WHERE 0';
  const result = await db.batch([
    db.prepare('SELECT revision FROM groupSettings WHERE id = 1'),
    db.prepare(`SELECT g.id, g.name, COUNT(m.userId) AS memberCount FROM userGroup g
      LEFT JOIN groupMembership m ON m.groupId = g.id GROUP BY g.id ORDER BY g.name LIMIT 30`),
    db.prepare(membershipSql).bind(...userIds),
  ]);
  return {
    revision: (result[0].results[0] as { revision: number }).revision,
    groups: result[1].results as ManagedGroup[],
    memberships: result[2].results as GroupMembership[],
  };
}

/**
 * 設定版を比較し、同じbatch内の変更にだけ一意の操作IDを許可する。
 * @param db D1接続。
 * @param revision 画面が取得した設定版。
 * @param change 検証済みの変更。
 * @returns 保存成功ならtrue。競合時は何も変更せずfalse。
 */
export async function saveGroupChange(db: D1Database, revision: number, change: GroupChange): Promise<boolean> {
  const mutationId = crypto.randomUUID();
  const guard = 'EXISTS (SELECT 1 FROM groupSettings WHERE id = 1 AND mutationId = ?)';
  const statements = [db.prepare(`UPDATE groupSettings SET revision = revision + 1, mutationId = ?
    WHERE id = 1 AND revision = ? RETURNING revision`).bind(mutationId, revision)];
  switch (change.kind) {
    case 'create':
      statements.push(db.prepare(`INSERT INTO userGroup(id, name) SELECT ?, ? WHERE ${guard}`)
        .bind(change.id, change.name, mutationId));
      break;
    case 'rename':
      statements.push(db.prepare(`UPDATE userGroup SET name = ? WHERE id = ? AND ${guard}`)
        .bind(change.name, change.id, mutationId));
      break;
    case 'delete':
      statements.push(db.prepare(`DELETE FROM userGroup WHERE id = ? AND ${guard}`).bind(change.id, mutationId));
      break;
    case 'membership':
      statements.push(db.prepare(`DELETE FROM groupMembership WHERE userId = ? AND ${guard}`).bind(change.userId, mutationId));
      for (const groupId of change.groupIds) {
        statements.push(db.prepare(`INSERT INTO groupMembership(userId, groupId) SELECT ?, ? WHERE ${guard}`)
          .bind(change.userId, groupId, mutationId));
      }
      break;
  }
  const result = await db.batch(statements);
  return result[0].results.length === 1;
}
