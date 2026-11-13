import assert from 'node:assert/strict';
import { test } from 'bun:test';
import { handleCalendar } from './api.ts';
import { parseEvent } from './validation.ts';
import { createCalendarFixture } from './fixture.test.ts';
import type { CalendarEvent, CalendarInput } from '../../../shared/calendar.ts';

const origin = 'https://example.test';
const query = '?from=2026-11-01T00:00&to=2026-12-01T00:00';
const input: CalendarInput = {
  title: '打ち合わせ', description: '説明', startAt: '2026-11-12T09:05', endAt: '2026-11-12T09:55', visibility: 'public',
};

/**
 * 確認済みユーザーを指定してAPIを実行する。
 * @param db 一時DB。
 * @param user 所有者。
 * @param method HTTPメソッド。
 * @param body JSON入力。
 * @param suffix クエリー。
 * @param source 送信元。
 * @returns HTTP応答。
 */
function request(db: D1Database, user: string, method = 'GET', body?: unknown, suffix = query, source = origin) {
  return handleCalendar(new Request(`${origin}/api/calendar${suffix}`, {
    method, headers: { Origin: source }, body: body ? JSON.stringify(body) : undefined,
  }), db, user);
}

/** @param db 接続。 @param user 閲覧者。 @param scope 表示範囲。 @returns 閲覧できる予定。 */
async function list(db: D1Database, user: string, scope = 'public') {
  const response = await request(db, user, 'GET', undefined, `${query}&scope=${scope}`);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('Cache-Control'), 'no-store');
  return (await response.json<{ events: CalendarEvent[] }>()).events;
}

/** 公開範囲・登録者名・編集権限・公開解除を、別ユーザーから検証する。 */
async function enforcesVisibilityAndOwnership() {
  const { db, sqlite } = createCalendarFixture();
  try {
    const response = await request(db, 'alice', 'POST', { ...input, userId: 'bob', ownerName: '偽名' });
    assert.equal(response.status, 201);
    const { id } = await response.json<{ id: string }>();
    await request(db, 'alice', 'POST', { ...input, title: 'アリスの非公開', visibility: 'private' });
    await request(db, 'bob', 'POST', { ...input, title: 'ボブの非公開', visibility: 'private' });
    assert.equal((await list(db, 'alice')).length, 2);
    const bobView = await list(db, 'bob');
    assert.equal(bobView.length, 2);
    const visible = bobView.find(/** @param event 候補。 @returns 共有予定か。 */ (event) => event.id === id)!;
    assert.equal(visible.ownerName, 'アリス');
    assert.equal(visible.isOwner, false);
    assert.equal(Object.hasOwn(visible, 'userId'), false);
    assert.equal((await list(db, 'bob', 'mine')).length, 1);
    assert.ok((await list(db, 'bob', 'mine')).every(/** @param event 候補。 @returns 本人の予定か。 */ (event) => event.isOwner));
    assert.equal((await request(db, 'bob', 'PUT', { ...input, id, revision: 0 })).status, 404);
    assert.equal((await request(db, 'bob', 'DELETE', { id, revision: 0 })).status, 404);
    assert.equal((await request(db, 'alice', 'PUT', { ...input, id, revision: 0, visibility: 'private' })).status, 200);
    assert.equal((await list(db, 'bob')).length, 1, 'PublicをPrivateへ変更すると他人の一覧から消える');
    assert.equal((await request(db, 'alice', 'PUT', { ...input, id, revision: 0 })).status, 409);
    assert.equal((await request(db, 'alice', 'DELETE', { id, revision: 0 })).status, 409);
    assert.equal((await request(db, 'alice', 'DELETE', { id, revision: 1 })).status, 200);
    assert.equal((await request(db, 'alice', 'DELETE', { id, revision: 1 })).status, 404);
  } finally {
    sqlite.close();
  }
}

/** 入力刻み・日時・期間・送信元とメソッドを検証する。 */
async function rejectsInvalidRequests() {
  const { db, sqlite } = createCalendarFixture();
  try {
    assert.ok(parseEvent(input));
    assert.equal(parseEvent({ ...input, startAt: '2026-11-12T09:01' }), null);
    assert.equal(parseEvent({ ...input, startAt: '2026-11-12T09:05:01' }), null);
    assert.equal(parseEvent({ ...input, endAt: input.startAt }), null);
    assert.equal(parseEvent({ ...input, startAt: '2026-02-30T09:05' }), null);
    assert.equal(parseEvent({ ...input, visibility: 'everyone' }), null);
    assert.equal((await request(db, 'alice', 'POST', { ...input, endAt: '2026-11-12T09:56' })).status, 400);
    assert.equal((await request(db, 'alice', 'GET', undefined, '?from=2026-01-01T00:00&to=2027-01-01T00:00')).status, 400);
    assert.equal((await request(db, 'alice', 'GET', undefined, `${query}&scope=other`)).status, 400);
    assert.equal((await request(db, 'alice', 'POST', input, query, 'https://attacker.test')).status, 403);
    assert.equal((await request(db, 'alice', 'PATCH', input)).status, 405);
    assert.equal((await request(db, 'alice', 'POST', { ...input, description: 'a'.repeat(33_000) })).status, 413);
  } finally {
    sqlite.close();
  }
}

test('予定のPrivate/Public・本人のみの変更・登録者名を保証する', enforcesVisibilityAndOwnership);
test('5分単位・前後関係・範囲・不正な操作を検証する', rejectsInvalidRequests);
