import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { URL as NodeURL } from 'node:url';

/**
 * D1のprepare/bind/first/runを、破棄可能なSQLiteで検証する。
 * @returns DBとD1のテスト用互換インターフェース。
 */
export function createTodoFixture() {
  const sqlite = new DatabaseSync(':memory:');
  sqlite.exec('PRAGMA foreign_keys = ON; CREATE TABLE "user" (id TEXT PRIMARY KEY); INSERT INTO "user" VALUES (\'alice\'), (\'bob\');');
  sqlite.exec(readFileSync(new NodeURL('../../../migrations/0003_todo.sql', import.meta.url), 'utf8'));
  const db = {
    /** @param sql 実行文。 @returns D1形式の準備済みクエリー。 */
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
      };
    },
  } as unknown as D1Database;
  return { db, sqlite };
}
