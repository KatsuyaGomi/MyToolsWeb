import { useState } from 'react';
import { closestCorners, DndContext, KeyboardSensor, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import type { DragEndEvent } from '@dnd-kit/core';
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import { useTodoBoard } from '../hooks/useTodoBoard';
import { moveTask, stepTask } from '../lib/board';
import { announcements } from '../lib/announcements';
import { BoardColumn } from '../components/BoardColumn';
import { TaskDialog } from '../components/TaskDialog';
import { StatusDialog } from '../components/StatusDialog';
import { primaryStyle, secondaryStyle } from '../components/TodoDialog';
import type { TodoTask } from '../types';

/**
 * 個人のTodoをステータス別に表示し、優先順や列をドラッグで変更する。
 * @returns Todoページ。
 */
export function TodoPage() {
  const { board, busy, error, save, reload } = useTodoBoard();
  const [editing, setEditing] = useState<TodoTask | null>(null);
  const [manageStatuses, setManageStatuses] = useState(false);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  /**
   * 指定列でタスクを作成する。
   * @param statusId 初期ステータス。
   */
  function add(statusId: string) {
    setEditing({ id: crypto.randomUUID(), title: '', description: '', priority: 'normal', statusId, dueDate: '' });
  }

  /**
   * ドロップ結果を保存する。領域外へのドロップは変更しない。
   * @param event 移動元・移動先。
   */
  function drop(event: DragEndEvent) {
    if (board && event.over) void save(moveTask(board, String(event.active.id), String(event.over.id)));
  }

  /**
   * 上下ボタンで優先順を変更する。
   * @param task 対象。
   * @param direction 上下の方向。
   */
  function step(task: TodoTask, direction: -1 | 1) {
    if (board) void save(stepTask(board, task, direction));
  }

  return (
    <section className="p-4 md:p-8">
      <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="mb-2 text-xs font-semibold tracking-widest text-accent">MY WORKSPACE / KANBAN</p>
          <h1 className="text-2xl font-semibold">Todo タスク</h1>
          <p className="mt-2 text-sm leading-6 text-muted">上にあるタスクほど優先。⠿ をドラッグして並び順・ステータスを変更できます。</p>
        </div>
        {board && <div className="flex flex-wrap gap-2">
          <button type="button" disabled={busy} className={secondaryStyle}
            onClick={/** 管理画面を開く。 */ () => setManageStatuses(true)}>ステータス管理</button>
          <button type="button" disabled={busy || board.tasks.length >= 500} className={primaryStyle}
            onClick={/** 最初の列へ追加する。 */ () => add(board.statuses[0].id)}>＋ タスク追加</button>
        </div>}
      </header>
      <div role="status" aria-live="polite" className="mb-4 min-h-5 text-xs text-muted">
        {busy ? 'D1へ保存中…' : board ? `${board.tasks.length} タスク · 自分専用のボード · 変更は自動保存` : '読み込み中…'}
      </div>
      {error && <div role="alert" className="mb-5 rounded border border-danger/40 bg-danger/5 p-3 text-sm text-danger">
        {error}
        {!board && <button type="button" onClick={reload} className="ml-3 underline">再試行</button>}
      </div>}
      {board && <DndContext sensors={sensors} collisionDetection={closestCorners} onDragEnd={drop}
        accessibility={{ announcements, screenReaderInstructions: { draggable: 'Spaceで持ち上げ、矢印キーで移動、Spaceで確定、Escapeで中止します。編集画面からもステータスを変更できます。' } }}>
        <div className="flex items-stretch gap-4 overflow-x-auto pb-6" aria-label="カンバンボード">
          {board.statuses.map(/** @param status 列の設定。 @returns ステータス別の列。 */ (status) => (
            <BoardColumn key={status.id} status={status} busy={busy} canAdd={board.tasks.length < 500}
              tasks={board.tasks.filter(/** @param task 対象タスク。 @returns この列に属するか。 */ (task) => task.statusId === status.id)}
              onAdd={add} onEdit={setEditing} onStep={step} />
          ))}
        </div>
      </DndContext>}
      {board && editing && <TaskDialog key={editing.id} task={editing} board={board} busy={busy} error={error} save={save}
        onClose={/** 編集を閉じる。 */ () => setEditing(null)} />}
      {board && manageStatuses && <StatusDialog board={board} busy={busy} error={error} save={save}
        onClose={/** 管理画面を閉じる。 */ () => setManageStatuses(false)} />}
    </section>
  );
}
