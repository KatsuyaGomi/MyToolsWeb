import { Database } from 'bun:sqlite';
import { readFileSync } from 'node:fs';
import { URL as NodeURL } from 'node:url';
import { sqliteD1 } from '../../testing/sqliteD1.ts';
import type { ChatActor } from './access.ts';

/** @returns グループ・セッションを持つ使い捨てDB。 */
export function chatFixture() {
  const sqlite = new Database(':memory:');
  sqlite.exec(`PRAGMA foreign_keys = ON;
    CREATE TABLE "user"(id TEXT PRIMARY KEY, name TEXT NOT NULL);
    CREATE TABLE session(id TEXT PRIMARY KEY,userId TEXT REFERENCES "user"(id),expiresAt INTEGER);
    INSERT INTO "user" VALUES ('alice','アリス'),('bob','ボブ'),('carol','キャロル');
    INSERT INTO session VALUES ('session-alice','alice',9999999999999),('session-bob','bob',9999999999999);`);
  for (const migration of ['0005_groups.sql', '0006_chat.sql']) {
    sqlite.exec(readFileSync(new NodeURL(`../../../migrations/${migration}`, import.meta.url), 'utf8'));
  }
  sqlite.exec(`INSERT INTO userGroup VALUES ('team-a','チームA'),('team-b','チームB');
    INSERT INTO groupMembership VALUES ('alice','team-a'),('bob','team-a'),('carol','team-b');
    INSERT INTO chatRoom(id,groupId) VALUES ('room-a','team-a'),('room-b','team-b');`);
  const db = sqliteD1(sqlite);
  return { db, sqlite };
}

/** @param id 利用者ID。 @param isAdmin 管理者か。 @returns テスト用の認証済み操作者。 */
export function actor(id = 'alice', isAdmin = false): ChatActor {
  return { id, name: id === 'alice' ? 'アリス' : 'ボブ', isAdmin, sessionId: `session-${id}` };
}
