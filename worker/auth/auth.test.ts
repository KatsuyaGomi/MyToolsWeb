import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Database } from 'bun:sqlite';
import { URL as NodeURL } from 'node:url';
import { test } from 'bun:test';
import { handleRequest } from '../index.ts';
import type { Env } from '../env.ts';
import { createAuth } from './createAuth.ts';

const origin = 'http://127.0.0.1:5173';

/**
 * テストごとに認証テーブルを持つ一時DBを作る。外部のDBへ接続しない。
 * @returns 一時DBとWorkerへ渡す設定。
 */
function createFixture() {
  const db = new Database(':memory:');
  db.exec(readFileSync(new NodeURL('../../migrations/0001_auth.sql', import.meta.url), 'utf8'));
  db.exec(readFileSync(new NodeURL('../../migrations/0002_admin.sql', import.meta.url), 'utf8'));
  const env: Env = {
    DB: db as unknown as D1Database,
    BETTER_AUTH_SECRET: 'test-only-secret-with-at-least-32-characters',
    BETTER_AUTH_URL: origin,
    ADMIN_EMAIL: 'alice@example.test',
  };
  return { db, env };
}

/**
 * 実際の認証ハンドラーへJSONリクエストを送る。
 * @param env テスト用の認証設定。
 * @param path リクエスト先のパス。
 * @param body POST時のJSONデータ。
 * @param cookie ログイン後のCookie。
 * @returns WorkerのHTTP応答。
 */
function requestApi(env: Env, path: string, body?: Record<string, unknown>, cookie = '') {
  return handleRequest(new Request(`${origin}${path}`, {
    method: body ? 'POST' : 'GET',
    headers: { 'Content-Type': 'application/json', Origin: origin, Cookie: cookie },
    body: body ? JSON.stringify(body) : undefined,
  }), env);
}

/**
 * テスト専用に信頼されたサーバー内部からユーザーを準備してログインする。
 * @param env 一時DBの設定。
 * @param input テストユーザーの入力。
 * @param role テストで確認する権限。
 * @returns パスワードログインの応答。
 */
async function seedUser(env: Env, input: { name: string; email: string; password: string }, role: 'admin' | 'user' = 'user') {
  await createAuth(env).api.createUser({ body: { ...input, role } });
  return requestApi(env, '/api/auth/sign-in/email', { email: input.email, password: input.password });
}

/**
 * 応答からセッションCookieを取得する。
 * @param response 登録・ログインの応答。
 * @returns 後続リクエストに送るセッションCookie。
 */
function sessionCookie(response: Response) {
  const header = response.headers.get('set-cookie') ?? '';
  const match = header.match(/(?:^|,\s*)(better-auth\.session_token=[^;]+)/);
  assert.ok(match, 'ログイン時にセッションCookieが発行される');
  assert.match(header, /HttpOnly/i);
  assert.match(header, /SameSite=Lax/i);
  return match[1];
}

/** 登録・ログアウト・再ログインと、パスワードが平文保存されないことを確認する。 */
async function authenticatesAndRevokesSession() {
  const { db, env } = createFixture();
  try {
    const password = 'test-password-1234';
    const registered = await seedUser(env, {
      name: '利用者A', email: 'alice@example.test', password,
    });
    assert.equal(registered.status, 200, await registered.clone().text());
    const cookie = sessionCookie(registered);
    const saved = db.prepare<{ password: string }, []>('SELECT password FROM account').get();
    assert.equal(typeof saved?.password, 'string');
    assert.notEqual(saved?.password, password);
    assert.equal((await requestApi(env, '/api/me', undefined, cookie)).status, 200);
    assert.equal((await requestApi(env, '/api/auth/sign-out', {}, cookie)).status, 200);
    assert.equal((await requestApi(env, '/api/me', undefined, cookie)).status, 401);
    const badLogin = await requestApi(env, '/api/auth/sign-in/email', {
      email: 'alice@example.test', password: 'incorrect-password',
    });
    assert.equal(badLogin.status, 401);
    const login = await requestApi(env, '/api/auth/sign-in/email', {
      email: 'alice@example.test', password,
    });
    assert.equal(login.status, 200);
    sessionCookie(login);
  } finally {
    db.close();
  }
}

/** セッション以外のuserId指定によって別ユーザーへ切り替えられないことを確認する。 */
async function isolatesUserIdentity() {
  const { db, env } = createFixture();
  try {
    const first = await seedUser(env, {
      name: '利用者A', email: 'alice@example.test', password: 'test-password-1234',
    });
    const second = await seedUser(env, {
      name: '利用者B', email: 'bob@example.test', password: 'test-password-5678',
    });
    const firstBody = await (await requestApi(env, '/api/me', undefined, sessionCookie(first))).json() as { user: { id: string } };
    const secondBody = await (await requestApi(env, '/api/me', undefined, sessionCookie(second))).json() as { user: { id: string } };
    assert.notEqual(firstBody.user.id, secondBody.user.id);
    const spoofed = await requestApi(env, `/api/me?userId=${secondBody.user.id}`, undefined, sessionCookie(first));
    const spoofedBody = await spoofed.json() as { user: { email: string } };
    assert.equal(spoofedBody.user.email, 'alice@example.test');
    assert.equal((await requestApi(env, '/api/me')).status, 401);
    assert.equal((await requestApi(env, '/api/missing', undefined, sessionCookie(first))).status, 404);
  } finally {
    db.close();
  }
}

/** 他サイトからの認証操作を拒否し、不正なCookieでもログインできないことを確認する。 */
async function rejectsCrossOriginAndInvalidCookies() {
  const { db, env } = createFixture();
  try {
    const response = await handleRequest(new Request(`${origin}/api/auth/sign-up/email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: 'https://untrusted.example' },
      body: JSON.stringify({ name: '利用者', email: 'alice@example.test', password: 'test-password-1234' }),
    }), env);
    assert.equal(response.status, 403);
    assert.equal((await requestApi(env, '/api/me', undefined, 'better-auth.session_token=invalid')).status, 401);
  } finally {
    db.close();
  }
}

test('account registration, password login and session revocation', authenticatesAndRevokesSession);
test('user identity is derived only from the authenticated session', isolatesUserIdentity);
test('cross-origin requests and invalid cookies are rejected', rejectsCrossOriginAndInvalidCookies);

/** 公開登録を拒否し、本人の管理者だけが一般ユーザーを作成できることを確認する。 */
async function restrictsAccountCreationToOwner() {
  const { db, env } = createFixture();
  const input = { name: '作成テスト', email: 'new@example.test', password: 'test-password-9012', role: 'admin' };
  try {
    assert.equal((await requestApi(env, '/api/auth/sign-up/email', input)).status, 403);
    assert.equal((await requestApi(env, '/api/auth/admin/create-user', input)).status, 403);
    assert.equal((await requestApi(env, '/api/admin/users', input)).status, 401);
    for (const path of ['/api/me', '/api/todo', '/api/calendar', '/api/chat/rooms', '/api/chat/device', '/api/groups', '/api/admin/groups', '/api/missing']) {
      assert.equal((await requestApi(env, path)).status, 401, `${path}も共通のセッション確認を通る`);
    }
    const normal = await seedUser(env, { name: '一般', email: 'bob@example.test', password: 'test-password-5678' });
    const normalCookie = sessionCookie(normal);
    assert.equal((await requestApi(env, '/api/admin/groups', undefined, normalCookie)).status, 403);
    const selfGroupChange = await handleRequest(new Request(`${origin}/api/admin/users/anything/groups`, {
      method: 'PUT', headers: { Origin: origin, Cookie: normalCookie, 'Content-Type': 'application/json' },
      body: JSON.stringify({ groupIds: [], revision: 0 }),
    }), env);
    assert.equal(selfGroupChange.status, 403);
    assert.equal((await requestApi(env, '/api/admin/users', input, normalCookie)).status, 403);
    const owner = await seedUser(env, { name: '所有者', email: 'alice@example.test', password: 'test-password-1234' }, 'admin');
    const ownerCookie = sessionCookie(owner);
    const created = await requestApi(env, '/api/admin/users', input, ownerCookie);
    assert.equal(created.status, 201, await created.clone().text());
    const user = (await created.json() as { user: { role: string } }).user;
    assert.equal(user.role, 'user');
    const wrongOwner = await seedUser(env, { name: '別の管理者', email: 'other@example.test', password: 'test-password-6789' }, 'admin');
    assert.equal((await requestApi(env, '/api/admin/users', input, sessionCookie(wrongOwner))).status, 403);
    const crossOrigin = await handleRequest(new Request(`${origin}/api/admin/users`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Origin: 'https://untrusted.example', Cookie: ownerCookie },
      body: JSON.stringify({ ...input, email: 'cross@example.test' }),
    }), env);
    assert.equal(crossOrigin.status, 403);
    const listing = await requestApi(env, '/api/admin/users', undefined, ownerCookie);
    assert.equal(listing.status, 200);
    assert.doesNotMatch(await listing.text(), /password|session_token/);
  } finally { db.close(); }
}

test('only the owner admin can create regular accounts', restrictsAccountCreationToOwner);
