import type { TodoBoard, TodoTask } from '../types';

/**
 * ドロップ先のカード直前または列末尾へ移動する。同じ列では入れ替え方向に応じて配置する。
 * @param board 現在のボード。
 * @param taskId 移動するタスク。
 * @param targetId カードIDまたはcolumn:で始まる列ID。
 * @returns 移動後のボード。無効な対象なら元のボード。
 */
export function moveTask(board: TodoBoard, taskId: string, targetId: string): TodoBoard {
  const tasks = [...board.tasks];
  const sourceIndex = tasks.findIndex(/** @param task 候補。 @returns 移動元か。 */ (task) => task.id === taskId);
  const targetIndex = tasks.findIndex(/** @param task 候補。 @returns 移動先か。 */ (task) => task.id === targetId);
  if (sourceIndex < 0 || taskId === targetId) return board;
  const source = tasks[sourceIndex];
  const statusId = targetId.startsWith('column:') ? targetId.slice(7) : tasks[targetIndex]?.statusId;
  if (!board.statuses.some(/** @param status 候補列。 @returns 存在する列か。 */ (status) => status.id === statusId)) return board;
  tasks.splice(sourceIndex, 1);
  const destination = targetIndex < 0 ? tasks.length : targetIndex;
  // 異なる列では常に対象の直前。同じ列の下方向は対象の直後。
  const index = source.statusId !== statusId && sourceIndex < targetIndex ? destination - 1 : destination;
  tasks.splice(index, 0, { ...source, statusId: statusId! });
  return { ...board, tasks };
}

/**
 * カードを同じ列の上下へ1段動かす。
 * @param board 現在のボード。
 * @param task 対象タスク。
 * @param direction 移動方向。
 * @returns 移動後のボード。
 */
export function stepTask(board: TodoBoard, task: TodoTask, direction: -1 | 1): TodoBoard {
  const columnTasks = board.tasks.filter(/** @param item 候補。 @returns 同じ列か。 */ (item) => item.statusId === task.statusId);
  const index = columnTasks.findIndex(/** @param item 候補。 @returns 対象か。 */ (item) => item.id === task.id);
  const target = columnTasks[index + direction];
  return target ? moveTask(board, task.id, target.id) : board;
}
