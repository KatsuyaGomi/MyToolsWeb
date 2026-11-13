import assert from 'node:assert/strict';
import { test } from 'bun:test';
import { handleTodo } from './api.ts';
import { createTodoFixture } from './fixture.test.ts';
import { parseBoard } from './validation.ts';
import type { TodoBoard } from '../../../shared/todo.ts';

/**
 * 認証済み所有者を指定してTodo APIへ要求する。
 * @param db 一時DB。
 * @param userId 確認済みのユーザー。
 * @param board 更新時の内容。
 * @param origin 送信元。
 * @returns HTTP応答。
 */
function request(db: D1Database, userId: string, board?: unknown, origin = 'https://example.test') {
  return handleTodo(new Request('https://example.test/api/todo', {
    method: board ? 'PUT' : 'GET', headers: { Origin: origin },
    body: board ? JSON.stringify(board) : undefined,
  }), db, userId);
}

/** 初期化、保存、別ユーザーの分離、競合時の上書き防止を検証する。 */
async function persistsIsolatedBoard() {
  const { db, sqlite } = createTodoFixture();
  try {
    const alice: TodoBoard = await (await request(db, 'alice')).json();
    assert.equal(alice.statuses.length, 3);
    assert.deepEqual(await (await request(db, 'alice')).json(), alice, '初期列のIDは変わらない');
    alice.statuses.push({ id: 'review', name: 'レビュー待ち', color: 'purple' });
    alice.tasks.push({ id: 'task1', title: '個人のタスク', description: '非公開', statusId: 'review', priority: 'high', dueDate: '2026-12-01' });
    const saved = await request(db, 'alice', alice);
    assert.equal(saved.status, 200);
    const updated: TodoBoard = await saved.json();
    assert.equal(updated.revision, 1);
    assert.deepEqual((await (await request(db, 'alice')).json<TodoBoard>()).tasks, alice.tasks);
    const bob = await (await request(db, 'bob')).json<TodoBoard>();
    assert.deepEqual(bob.tasks, []);
    assert.equal(bob.statuses.length, 3);
    // userIdを本文に入れても所有者はセッションから渡されたbobのまま。
    assert.equal((await request(db, 'bob', { ...bob, ...{ userId: 'alice' } })).status, 200);
    assert.equal((await request(db, 'alice', alice)).status, 409);
    assert.deepEqual(await (await request(db, 'alice')).json(), updated);
    assert.equal((await request(db, 'alice', updated, 'https://attacker.test')).status, 403);
  } finally {
    sqlite.close();
  }
}

/** 未定義列、重複ID、不正な日付・優先度・件数を拒否する。 */
function rejectsInvalidInput() {
  const board: TodoBoard = { revision: 0, statuses: [{ id: 'a', name: '未着手', color: 'gray' }], tasks: [] };
  const task = { id: 't', title: 'a', description: '', statusId: 'a', priority: 'normal', dueDate: '' };
  assert.ok(parseBoard({ ...board, tasks: [task] }));
  assert.equal(parseBoard({ ...board, tasks: [{ ...task, statusId: 'other' }] }), null);
  assert.equal(parseBoard({ ...board, tasks: [task, task] }), null);
  assert.equal(parseBoard({ ...board, tasks: [{ ...task, priority: '__proto__' }] }), null);
  assert.equal(parseBoard({ ...board, tasks: [{ ...task, dueDate: '2026-02-30' }] }), null);
  assert.equal(parseBoard({ ...board, statuses: [] }), null);
  assert.equal(parseBoard({ ...board, tasks: Array(501).fill(task) }), null);
}

test('Todoは所有者別に保存し、古い版の更新を拒否する', persistsIsolatedBoard);
test('Todoの不正入力を拒否する', rejectsInvalidInput);
