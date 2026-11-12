import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { TaskCard } from './TaskCard';
import type { TodoStatus, TodoTask } from '../types';

interface Props {
  status: TodoStatus;
  tasks: TodoTask[];
  busy: boolean;
  canAdd: boolean;
  onAdd: (statusId: string) => void;
  onEdit: (task: TodoTask) => void;
  onStep: (task: TodoTask, direction: -1 | 1) => void;
}

export const colorStyles = {
  blue: 'bg-blue-400', amber: 'bg-amber-400', green: 'bg-emerald-400', purple: 'bg-purple-400', gray: 'bg-slate-400',
};

/**
 * 空の列にもタスクをドロップできるステータス列。
 * @param props 列・タスクと操作。
 * @returns ボードの1列。
 */
export function BoardColumn({ status, tasks, busy, canAdd, onAdd, onEdit, onStep }: Props) {
  const { setNodeRef, isOver } = useDroppable({ id: `column:${status.id}`, disabled: busy });
  const ids = tasks.map(/** @param task 対象タスク。 @returns ソート用ID。 */ (task) => task.id);
  return (
    <section ref={setNodeRef} aria-label={status.name}
      className={`flex min-h-96 w-76 shrink-0 flex-col rounded-lg border bg-panel ${isOver ? 'border-accent' : 'border-line'}`}>
      <div className={`h-1 rounded-t-lg ${colorStyles[status.color]}`} />
      <header className="flex items-center gap-2 px-4 py-4">
        <h2 className="min-w-0 flex-1 break-words text-sm font-semibold">{status.name}</h2>
        <span className="rounded-full bg-elevated px-2 py-0.5 text-xs text-muted">{tasks.length}</span>
        <button type="button" disabled={busy || !canAdd} aria-label={`${status.name}にタスク追加`}
          onClick={/** この列の追加画面を開く。 */ () => onAdd(status.id)} className="rounded px-2 text-lg text-muted hover:bg-elevated">＋</button>
      </header>
      <SortableContext items={ids} strategy={verticalListSortingStrategy}>
        <div className="flex flex-1 flex-col gap-3 px-3 pb-4">
          {tasks.map(/** @param task 表示対象。 @returns 操作できるカード。 */ (task) => (
            <TaskCard key={task.id} task={task} busy={busy} onEdit={onEdit} onStep={onStep} />
          ))}
          {tasks.length === 0 && <p className="rounded border border-dashed border-line px-3 py-8 text-center text-xs leading-6 text-muted">タスクはありません<br />ここへドラッグして移動</p>}
        </div>
      </SortableContext>
    </section>
  );
}
