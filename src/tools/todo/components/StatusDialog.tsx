import { useState } from 'react';
import type { FormEvent } from 'react';
import { statusColors } from '../types';
import type { StatusColor, TodoBoard, TodoStatus } from '../types';
import { TodoDialog, fieldStyle, primaryStyle, secondaryStyle } from './TodoDialog';

/**
 * 個人のステータスを追加・編集する。タスクが残る列と最後の列は削除しない。
 * @param props 現在のボード、保存操作、状態。
 * @returns ステータス管理ダイアログ。
 */
export function StatusDialog({ board, busy, error, save, onClose }: {
  board: TodoBoard; busy: boolean; error: string;
  save: (board: TodoBoard) => Promise<boolean>; onClose: () => void;
}) {
  const [statuses, setStatuses] = useState(board.statuses);

  /**
   * 1列の入力を下書きへ反映する。
   * @param id 対象列。
   * @param patch 名前または色。
   */
  function update(id: string, patch: Partial<TodoStatus>) {
    setStatuses(statuses.map(/** @param status 既存列。 @returns 更新後の列。 */ (status) => status.id === id ? { ...status, ...patch } : status));
  }

  /** 新しいステータスを下書きの末尾に追加する。 */
  function add() {
    setStatuses([...statuses, { id: crypto.randomUUID(), name: '', color: 'purple' }]);
  }

  /**
   * ステータスの変更をまとめて保存する。
   * @param event 送信操作。
   */
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (await save({ ...board, statuses })) onClose();
  }

  return (
    <TodoDialog title="ステータス管理" busy={busy} onClose={onClose}>
      <p className="mb-4 text-sm leading-6 text-muted">自分のボードにだけ反映されます。タスクのある列は、先にタスクを移動してから削除してください。</p>
      <form onSubmit={submit} className="space-y-4">
        <fieldset disabled={busy} className="space-y-4">
          {statuses.map(/** @param status 編集する列。 @param index 表示位置。 @returns 列の編集欄。 */ (status, index) => {
            const occupied = board.tasks.some(/** @param task 既存タスク。 @returns この列にあるか。 */ (task) => task.statusId === status.id);
            return (
              <div key={status.id} className="rounded border border-line p-3">
                <div className="grid grid-cols-[1fr_5rem] gap-3">
                  <label className="min-w-0 text-xs text-muted">ステータス名 {index + 1}
                    <input required maxLength={50} value={status.name} className={fieldStyle}
                      onChange={/** 名前を更新する。 @param event 入力変更。 */ (event) => update(status.id, { name: event.target.value })} />
                  </label>
                  <label className="text-xs text-muted">色
                    <select value={status.color} className={fieldStyle}
                      onChange={/** 色を更新する。 @param event 選択変更。 */ (event) => update(status.id, { color: event.target.value as StatusColor })}>
                      {Object.entries(statusColors).map(/** @param entry 色キーと名前。 @returns 色の選択肢。 */ ([key, name]) => <option key={key} value={key}>{name}</option>)}
                    </select>
                  </label>
                </div>
                <button type="button" disabled={occupied || statuses.length === 1} className="mt-2 text-xs text-danger disabled:text-muted disabled:opacity-50"
                  onClick={/** 空の列を下書きから外す。 */ () => setStatuses(statuses.filter(/** @param item 候補列。 @returns 対象以外か。 */ (item) => item.id !== status.id))}>
                  {occupied ? 'タスクがあるため削除できません' : statuses.length === 1 ? '最後のステータスは削除できません' : 'このステータスを削除'}
                </button>
              </div>
            );
          })}
          <button type="button" disabled={statuses.length >= 30} onClick={add} className={secondaryStyle}>＋ ステータスを追加</button>
          <p className="text-xs text-muted">最大30ステータス / ボード全体で最大500タスク</p>
        </fieldset>
        {error && <p role="alert" className="text-sm text-danger">{error}</p>}
        <div className="flex justify-end gap-2 border-t border-line pt-4">
          <button type="button" disabled={busy} onClick={onClose} className={secondaryStyle}>キャンセル</button>
          <button type="submit" disabled={busy} className={primaryStyle}>{busy ? '保存中…' : '保存する'}</button>
        </div>
      </form>
    </TodoDialog>
  );
}
