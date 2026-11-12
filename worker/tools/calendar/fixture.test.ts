import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { URL as NodeURL } from 'node:url';

/** @returns 破棄可能なSQLiteとD1形式のテスト用接続。 */
export function createCalendarFixture() {
  const sqlite = new DatabaseSync(':memory:');
  sqlite.exec(`PRAGMA foreign_keys = ON;
    CREATE TABLE "user" (id TEXT PRIMARY KEY, name TEXT NOT NULL);
    INSERT INTO "user" VALUES ('alice', 'アリス'), ('bob', 'ボブ');`);
  sqlite.exec(readFileSync(new NodeURL('../../../migrations/0004_calendar.sql', import.meta.url), 'utf8'));
  const db = {
    /** @param sql 実行文。 @returns D1形式のクエリー。 */
    prepare(sql: string) {
      const statement = sqlite.prepare(sql);
      let values: (string | number)[] = [];
      return {
        /** @param args パラメーター。 @returns 自分自身。 */
        bind(...args: (string | number)[]) {
          values = args;
          return this;
        },
        /** @returns 最初の1行。 */
        async first() {
          return statement.get(...values) ?? null;
        },
        /** @returns 実行結果。 */
        async run() {
          return statement.run(...values);
        },
        /** @returns 全行。 */
        async all() {
          return { results: statement.all(...values) };
        },
      };
    },
  } as unknown as D1Database;
  return { db, sqlite };
}
