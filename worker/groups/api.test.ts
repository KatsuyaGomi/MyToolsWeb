import assert from 'node:assert/strict';
import { test } from 'bun:test';
import { Database } from 'bun:sqlite';
import { readFileSync } from 'node:fs';
import { URL as NodeURL } from 'node:url';
import { sqliteD1 } from '../testing/sqliteD1.ts';
import { handleGroups } from './api.ts';
import { readDirectory, saveGroupChange } from './repository.ts';
import type { AuthSession } from '../http/types.ts';
import type { GroupDirectory } from '../../shared/groups.ts';

const origin = 'https://example.test';

/** @returns グループ管理API専用の一時DBと管理者セッション。 */
function fixture() {
  const sqlite = new Database(':memory:');
  sqlite.exec(`PRAGMA foreign_keys = ON; CREATE TABLE "user" (id TEXT PRIMARY KEY);
    INSERT INTO "user" VALUES ('owner'), ('member');`);
  sqlite.exec(readFileSync(new NodeURL('../../migrations/0005_groups.sql', import.meta.url), 'utf8'));
  const env = { DB: sqliteD1(sqlite), ADMIN_EMAIL: 'owner@example.test', BETTER_AUTH_URL: origin };
  const session = { user: { id: 'owner', email: 'owner@example.test', role: 'admin' } } as AuthSession;
  return { sqlite, env, session };
}

/** @param method HTTPメソッド。 @param body 入力。 @param source 送信元。 @returns テスト要求。 */
function request(method: string, body?: unknown, source = origin) {
  return new Request(`${origin}/api/admin/groups?userId=member`, {
    method, headers: { Origin: source }, body: body ? JSON.stringify(body) : undefined,
  });
}

/** 管理者本人の限定、複数所属、重複時のロールバックと競合処理を確認する。 */
async function managesMembershipsAtomically() {
  const { sqlite, env, session } = fixture();
  try {
    const normal = { ...session, user: { ...session.user, role: 'user' } };
    const wrongAdmin = { ...session, user: { ...session.user, email: 'other@example.test' } };
    assert.equal((await handleGroups(request('GET'), env, normal)).status, 403);
    assert.equal((await handleGroups(request('GET'), env, wrongAdmin)).status, 403);
    assert.equal((await handleGroups(request('POST', { name: 'A', revision: 0 }, 'https://attacker.test'), env, session)).status, 403);
    assert.equal((await handleGroups(request('POST', { name: 'A', revision: 0 }), env, session)).status, 201);
    assert.equal((await handleGroups(request('POST', { name: 'B', revision: 1 }), env, session)).status, 201);
    const directory = await (await handleGroups(request('GET'), env, session)).json<GroupDirectory>();
    assert.equal(directory.groups.length, 2);
    const ids = directory.groups.map(/** @param group 対象。 @returns ID。 */ (group) => group.id);
    const assign = await handleGroups(request('PUT', { groupIds: ids, revision: 2 }), env, session, { userId: 'member' });
    assert.equal(assign.status, 200);
    let saved = await readDirectory(env.DB, ['member']);
    assert.equal(saved.memberships.length, 2);
    assert.equal((await handleGroups(request('PUT', { groupIds: [], revision: 2 }), env, session, { userId: 'member' })).status, 409);
    assert.equal(await saveGroupChange(env.DB, 2, { kind: 'membership', userId: 'member', groupIds: [] }), false);
    assert.equal((await readDirectory(env.DB, ['member'])).memberships.length, 2);
    assert.equal((await handleGroups(request('POST', { name: 'A', revision: 3 }), env, session)).status, 400);
    assert.equal((await readDirectory(env.DB, [])).revision, 3, '重複時は版番号も戻す');
    assert.equal((await handleGroups(request('PUT', { groupIds: ['missing'], revision: 3 }), env, session, { userId: 'member' })).status, 400);
    assert.equal((await readDirectory(env.DB, ['member'])).memberships.length, 2, '不正入力で既存の所属を消さない');
    assert.equal((await handleGroups(request('PUT', { groupIds: ids, revision: 3 }), env, session, { userId: 'unknown' })).status, 404);
    assert.equal((await handleGroups(request('PUT', { name: '新A', revision: 3 }), env, session, { groupId: ids[0] })).status, 200);
    assert.equal((await handleGroups(request('DELETE', { revision: 4 }), env, session, { groupId: ids[0] })).status, 200);
    saved = await readDirectory(env.DB, ['member']);
    assert.equal(saved.memberships.length, 1);
    assert.equal((await handleGroups(request('PUT', { groupIds: [], revision: 5 }), env, session, { userId: 'member' })).status, 200);
    assert.equal((await readDirectory(env.DB, ['member'])).memberships.length, 0);
  } finally {
    sqlite.close();
  }
}

test('グループ設定は管理者本人だけが原子的に変更できる', managesMembershipsAtomically);
