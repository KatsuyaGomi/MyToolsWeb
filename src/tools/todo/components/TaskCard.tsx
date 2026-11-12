import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { priorities } from '../types';
import type { TodoTask } from '../types';

interface Props {
  task: TodoTask;
  busy: boolean;
  onEdit: (task: TodoTask) => void;
  onStep: (task: TodoTask, direction: -1 | 1) => void;
}

const priorityStyles = {
  urgent: 'bg-red-400/15 text-red-300', high: 'bg-amber-400/15 text-amber-200',
  normal: 'bg-blue-400/15 text-blue-200', low: 'bg-slate-400/15 text-slate-300',
};

/**
 * ドラッグ用ハンドルと編集ボタンを備えるタスクカード。
 * @param props タスクと操作ハンドラー。
 * @returns カード。
 */
export function TaskCard({ task, busy, onEdit, onStep }: Props) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: task.id, disabled: busy });
  const overdue = task.dueDate !== '' && task.dueDate < new Date().toLocaleDateString('sv-SE');
  return (
    <article ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`rounded-lg border border-line bg-elevated shadow-sm ${isDragging ? 'relative z-20 opacity-50 ring-2 ring-accent' : ''}`}>
      <div className="flex items-center justify-between border-b border-line/60 px-3 py-2">
        <span className={`rounded px-2 py-0.5 text-xs font-medium ${priorityStyles[task.priority]}`}>{priorities[task.priority]}</span>
        <button {...attributes} {...listeners} type="button" disabled={busy}
          aria-label={`${task.title}をドラッグして移動`} title="ドラッグ、またはSpaceで持ち上げて矢印キーで移動"
          className="touch-none cursor-grab rounded px-2 text-lg text-muted hover:bg-panel focus-visible:outline-2 focus-visible:outline-accent active:cursor-grabbing">⠿</button>
      </div>
      <button type="button" disabled={busy} onClick={/** 編集を開く。 */ () => onEdit(task)}
        className="block w-full rounded px-3 py-3 text-left hover:bg-panel/60 focus-visible:outline-2 focus-visible:outline-accent">
        <span className="block break-words text-sm font-semibold">{task.title}</span>
        {task.description && <span className="mt-2 line-clamp-3 block whitespace-pre-wrap break-words text-xs leading-5 text-muted">{task.description}</span>}
        {task.dueDate && <span className={`mt-3 block text-xs ${overdue ? 'text-amber-200' : 'text-muted'}`}>期限 {task.dueDate}{overdue ? '（期限超過）' : ''}</span>}
      </button>
      <div className="flex justify-end gap-1 px-2 pb-2">
        <button type="button" disabled={busy} aria-label={`${task.title}の優先順を上げる`}
          onClick={/** 上へ移動する。 */ () => onStep(task, -1)} className="rounded px-2 text-muted hover:bg-panel disabled:opacity-40">↑</button>
        <button type="button" disabled={busy} aria-label={`${task.title}の優先順を下げる`}
          onClick={/** 下へ移動する。 */ () => onStep(task, 1)} className="rounded px-2 text-muted hover:bg-panel disabled:opacity-40">↓</button>
      </div>
    </article>
  );
}
