/// <reference types="node" />
import assert from 'node:assert/strict';
import test from 'node:test';
import { moveTask, stepTask } from './board.ts';
import type { TodoBoard } from '../types';

/** 列内の上下移動、列間移動、空列への移動でタスクが失われないことを確認する。 */
function reordersWithoutLosingTasks() {
  const board: TodoBoard = {
    revision: 1,
    statuses: [{ id: 'a', name: '未着手', color: 'gray' }, { id: 'b', name: '完了', color: 'green' }],
    tasks: ['one', 'two', 'three'].map(/** @param id 識別子。 @returns テスト用タスク。 */ (id) => ({
      id, title: id, description: '', statusId: 'a', priority: 'high', dueDate: '',
    })),
  };
  const down = moveTask(board, 'one', 'three');
  assert.deepEqual(down.tasks.map(/** @param task 対象。 @returns ID。 */ (task) => task.id), ['two', 'three', 'one']);
  assert.deepEqual(stepTask(down, down.tasks[2], -1).tasks.map(/** @param task 対象。 @returns ID。 */ (task) => task.id), ['two', 'one', 'three']);
  const moved = moveTask(board, 'one', 'column:b');
  assert.equal(moved.tasks.length, 3);
  assert.equal(moved.tasks[2].statusId, 'b');
  assert.equal(moved.tasks[2].priority, 'high');
  assert.equal(board.tasks[0].statusId, 'a', '元のデータを変更しない');
  assert.equal(moveTask(board, 'one', 'missing'), board);
  assert.equal(moveTask(board, 'one', 'one'), board);
}

test('ドラッグと上下操作でタスクの順序・ステータスを更新する', reordersWithoutLosingTasks);
