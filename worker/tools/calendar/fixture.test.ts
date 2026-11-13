import { Database } from 'bun:sqlite';
import { readFileSync } from 'node:fs';
import { URL as NodeURL } from 'node:url';
import { sqliteD1 } from '../../testing/sqliteD1.ts';

/** @returns 破棄可能なSQLiteとD1形式のテスト用接続。 */
export function createCalendarFixture() {
  const sqlite = new Database(':memory:');
  sqlite.exec(`PRAGMA foreign_keys = ON;
    CREATE TABLE "user" (id TEXT PRIMARY KEY, name TEXT NOT NULL);
    INSERT INTO "user" VALUES ('alice', 'アリス'), ('bob', 'ボブ'), ('carol', 'キャロル'), ('dave', 'デイブ');`);
  sqlite.exec(readFileSync(new NodeURL('../../../migrations/0004_calendar.sql', import.meta.url), 'utf8'));
  sqlite.exec(readFileSync(new NodeURL('../../../migrations/0005_groups.sql', import.meta.url), 'utf8'));
  sqlite.exec(`INSERT INTO userGroup VALUES ('team-a', 'チームA'), ('team-b', 'チームB'), ('team-c', 'チームC');
    INSERT INTO groupMembership VALUES ('alice', 'team-a'), ('alice', 'team-b'),
      ('bob', 'team-a'), ('bob', 'team-b'), ('carol', 'team-b'), ('dave', 'team-c');`);
  const db = sqliteD1(sqlite);
  return { db, sqlite };
}
