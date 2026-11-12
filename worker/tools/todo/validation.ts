import { priorities, statusColors } from '../../../shared/todo.ts';
import type { TodoBoard } from '../../../shared/todo.ts';

/**
 * 長さ制限付きの文字列かを判定する。
 * @param value 入力値。
 * @param maximum 最大文字数。
 * @param required 空白だけの入力を禁止するか。
 * @returns 条件を満たす場合はtrue。
 */
function validText(value: unknown, maximum: number, required = false): value is string {
  return typeof value === 'string' && value.length <= maximum && (!required || value.trim().length > 0);
}

/**
 * JSONオブジェクトかを判定する。
 * @param value 入力値。
 * @returns 配列以外のオブジェクトの場合はtrue。
 */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * クライアントのボードを検証し、受け付ける項目だけを取り出す。
 * @param value 未検証の入力。
 * @returns 検証済みボード。不正な場合はnull。
 */
export function parseBoard(value: unknown): TodoBoard | null {
  if (!isRecord(value) || !Number.isSafeInteger(value.revision) || Number(value.revision) < 0) return null;
  if (!Array.isArray(value.statuses) || value.statuses.length < 1 || value.statuses.length > 30) return null;
  if (!Array.isArray(value.tasks) || value.tasks.length > 500) return null;
  const board: TodoBoard = { revision: Number(value.revision), statuses: [], tasks: [] };
  const statusIds = new Set<string>();
  const taskIds = new Set<string>();
  for (const status of value.statuses) {
    if (!isRecord(status) || !validText(status.id, 64, true) || statusIds.has(status.id)) return null;
    if (!validText(status.name, 50, true) || typeof status.color !== 'string' || !Object.hasOwn(statusColors, status.color)) return null;
    statusIds.add(status.id);
    board.statuses.push({ id: status.id, name: status.name.trim(), color: status.color as keyof typeof statusColors });
  }
  for (const task of value.tasks) {
    if (!isRecord(task) || !validText(task.id, 64, true) || taskIds.has(task.id)) return null;
    if (typeof task.statusId !== 'string' || !statusIds.has(task.statusId)) return null;
    if (!validText(task.title, 200, true) || !validText(task.description, 4000)) return null;
    if (typeof task.priority !== 'string' || !Object.hasOwn(priorities, task.priority)) return null;
    if (typeof task.dueDate !== 'string') return null;
    if (task.dueDate !== '' && (!/^\d{4}-\d{2}-\d{2}$/.test(task.dueDate) ||
      !Number.isFinite(Date.parse(task.dueDate)) || new Date(task.dueDate).toISOString().slice(0, 10) !== task.dueDate)) return null;
    taskIds.add(task.id);
    board.tasks.push({
      id: task.id, statusId: task.statusId, title: task.title.trim(), description: task.description,
      priority: task.priority as keyof typeof priorities, dueDate: task.dueDate,
    });
  }
  return board;
}
