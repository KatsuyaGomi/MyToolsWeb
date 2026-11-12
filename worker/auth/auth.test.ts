import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { URL as NodeURL } from 'node:url';
import test from 'node:test';
import { handleRequest } from '../index.ts';
import type { Env } from '../env.ts';

const origin = 'http://127.0.0.1:5173';

/**
 * テストごとに認証テーブルを持つ一時DBを作る。外部のDBへ接続しない。
 * @returns 一時DBとWorkerへ渡す設定。
 */
function createFixture() {
  const db = new DatabaseSync(':memory:');
  db.exec(readFileSync(new NodeURL('../../migrations/0001_auth.sql', import.meta.url), 'utf8'));
  const env: Env = {
    DB: db as unknown as D1Database,
    BETTER_AUTH_SECRET: 'test-only-secret-with-at-least-32-characters',
    BETTER_AUTH_URL: origin,
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
    const registered = await requestApi(env, '/api/auth/sign-up/email', {
      name: '利用者A', email: 'alice@example.test', password,
    });
    assert.equal(registered.status, 200, await registered.clone().text());
    const cookie = sessionCookie(registered);
    const saved = db.prepare('SELECT password FROM account').get();
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
    const first = await requestApi(env, '/api/auth/sign-up/email', {
      name: '利用者A', email: 'alice@example.test', password: 'test-password-1234',
    });
    const second = await requestApi(env, '/api/auth/sign-up/email', {
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
