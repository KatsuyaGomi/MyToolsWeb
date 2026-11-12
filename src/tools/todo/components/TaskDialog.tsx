import { useState } from 'react';
import type { FormEvent } from 'react';
import { priorities } from '../types';
import type { Priority, TodoBoard, TodoTask } from '../types';
import { TodoDialog, fieldStyle, primaryStyle, secondaryStyle } from './TodoDialog';

interface Props {
  task: TodoTask;
  board: TodoBoard;
  busy: boolean;
  error: string;
  save: (board: TodoBoard) => Promise<boolean>;
  onClose: () => void;
}

/**
 * タスクの追加・編集・削除を行う。
 * @param props 編集対象、現在のボード、保存操作。
 * @returns 入力ダイアログ。
 */
export function TaskDialog({ task, board, busy, error, save, onClose }: Props) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const existing = board.tasks.some(/** @param item 既存タスク。 @returns 編集対象か。 */ (item) => item.id === task.id);

  /**
   * フォーム値を読み、同じIDのタスクを更新する。
   * @param event フォーム送信。
   */
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const updated: TodoTask = {
      ...task, title: String(data.get('title')).trim(), description: String(data.get('description')),
      priority: String(data.get('priority')) as Priority, statusId: String(data.get('statusId')),
      dueDate: String(data.get('dueDate')),
    };
    const tasks = existing
      ? board.tasks.map(/** @param item 既存タスク。 @returns 更新後のタスク。 */ (item) => item.id === task.id ? updated : item)
      : [...board.tasks, updated];
    if (await save({ ...board, tasks })) onClose();
  }

  /** 確認済みのタスクを削除し、保存できたら閉じる。 */
  async function remove() {
    const tasks = board.tasks.filter(/** @param item 既存タスク。 @returns 削除対象以外か。 */ (item) => item.id !== task.id);
    if (await save({ ...board, tasks })) onClose();
  }

  return (
    <TodoDialog title={existing ? 'タスクを編集' : 'タスクを追加'} busy={busy} onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <fieldset disabled={busy} className="space-y-4 disabled:opacity-60">
          <label className="block text-sm">タイトル <span className="text-muted">（必須）</span>
            <input autoFocus required name="title" maxLength={200} defaultValue={task.title} className={fieldStyle} />
          </label>
          <label className="block text-sm">説明
            <textarea name="description" maxLength={4000} rows={4} defaultValue={task.description} className={fieldStyle} />
          </label>
          <div className="grid grid-cols-2 gap-4">
            <label className="block text-sm">ステータス
              <select name="statusId" defaultValue={task.statusId} className={fieldStyle}>
                {board.statuses.map(/** @param status 選択肢。 @returns ステータス項目。 */ (status) => <option key={status.id} value={status.id}>{status.name}</option>)}
              </select>
            </label>
            <label className="block text-sm">優先度
              <select name="priority" defaultValue={task.priority} className={fieldStyle}>
                {Object.entries(priorities).map(/** @param entry キーと表示名。 @returns 優先度項目。 */ ([key, name]) => <option key={key} value={key}>{name}</option>)}
              </select>
            </label>
          </div>
          <label className="block text-sm">期限 <span className="text-muted">（任意）</span>
            <input name="dueDate" type="date" min="0001-01-01" max="9999-12-31" defaultValue={task.dueDate} className={fieldStyle} />
          </label>
        </fieldset>
        {error && <p role="alert" className="text-sm text-danger">{error}</p>}
        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-line pt-4">
          {existing && !confirmDelete && <button type="button" disabled={busy}
            onClick={/** 削除確認を表示する。 */ () => setConfirmDelete(true)} className="mr-auto text-sm text-danger">削除する</button>}
          <button type="button" disabled={busy} onClick={onClose} className={secondaryStyle}>キャンセル</button>
          <button type="submit" disabled={busy} className={primaryStyle}>{busy ? '保存中…' : '保存する'}</button>
        </div>
        {confirmDelete && <div className="rounded border border-danger/40 p-3 text-sm">
          <p>このタスクを削除しますか？</p>
          <button type="button" disabled={busy} onClick={remove} className="mt-3 rounded bg-danger px-3 py-2 text-canvas">削除を確定</button>
        </div>}
      </form>
    </TodoDialog>
  );
}
