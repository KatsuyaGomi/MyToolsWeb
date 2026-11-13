import type { AuthSession } from '../../http/types.ts';

export interface ChatActor {
  id: string;
  name: string;
  isAdmin: boolean;
  sessionId: string;
}

// すべてのSQLで、現在の所属を再検証する。roomIdだけでは認可しない。
export const memberSql = `EXISTS (SELECT 1 FROM chatRoom room JOIN groupMembership membership
  ON membership.groupId = room.groupId WHERE room.id = ? AND membership.userId = ?)`;

/** @param db 接続。 @param roomId 部屋。 @param userId 閲覧者。 @returns 現在の部屋情報またはnull。 */
export async function accessibleRoom(db: D1Database, roomId: string, userId: string) {
  return db.prepare(`SELECT id, version FROM chatRoom WHERE id = ? AND ${memberSql}`)
    .bind(roomId, roomId, userId).first<{ id: string; version: number }>();
}

/** @param session 検証済みセッション。 @param isAdmin 管理者本人か。 @returns チャット操作に必要な本人情報。 */
export function chatActor(session: AuthSession, isAdmin: boolean): ChatActor {
  return { id: session.user.id, name: session.user.name, sessionId: session.session.id, isAdmin };
}
