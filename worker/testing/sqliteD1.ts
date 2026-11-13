import type { Database } from 'bun:sqlite';

/**
 * D1のクエリーと原子的なbatchを、テスト専用のBun SQLiteで再現する。
 * @param sqlite メモリー上のテストDB。
 * @returns D1互換のテスト接続。本番コードからは使わない。
 */
export function sqliteD1(sqlite: Database): D1Database {
  const adapter = {
    /** @param sql バインド前のSQL。 @returns 準備済みクエリー。 */
    prepare(sql: string) {
      const statement = sqlite.prepare(sql);
      let values: (string | number | null)[] = [];
      return {
        /** @param args バインドする値。 @returns 自分自身。 */
        bind(...args: (string | number | null)[]) {
          values = args;
          return this;
        },
        /** @returns 最初の行。 */
        async first() {
          return statement.get(...values) ?? null;
        },
        /** @returns 行と実行結果。 */
        async all() {
          const results = statement.all(...values);
          return { success: true, results, meta: {} };
        },
        /** @returns 実行結果。 */
        async run() {
          statement.run(...values);
          return { success: true, results: [], meta: {} };
        },
      };
    },
    /** @param statements まとめて実行する文。 @returns 全実行結果。 @throws 失敗時は全変更を戻して再送出する。 */
    async batch(statements: D1PreparedStatement[]) {
      sqlite.exec('BEGIN');
      try {
        const results = [];
        for (const statement of statements) results.push(await statement.all());
        sqlite.exec('COMMIT');
        return results;
      } catch (error) {
        sqlite.exec('ROLLBACK');
        throw error;
      }
    },
  };
  return adapter as unknown as D1Database;
}
