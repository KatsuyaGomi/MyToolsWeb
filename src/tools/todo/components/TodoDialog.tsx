import { useEffect, useRef } from 'react';
import type { ReactNode } from 'react';

/**
 * フォーカス管理と背景操作の抑止をブラウザーに任せるモーダル。
 * @param props 見出し、内容、閉じる処理と保存中の状態。
 * @returns ネイティブダイアログ。
 */
export function TodoDialog({ title, children, onClose, busy }: {
  title: string; children: ReactNode; onClose: () => void; busy: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(/** マウント時に表示し、閉じたら起点へフォーカスを戻す。 @returns 終了処理。 */ () => {
    const previous = document.activeElement;
    const dialog = ref.current;
    dialog?.showModal();
    return /** ダイアログを閉じ、元の操作対象に戻す。 */ () => {
      dialog?.close();
      if (previous instanceof HTMLElement && previous.isConnected) previous.focus();
    };
  }, []);
  return (
    <dialog ref={ref} aria-labelledby="todo-dialog-title"
      onCancel={/** 保存中は閉じず、通常は親の状態を閉じる。 @param event キャンセル操作。 */ (event) => {
        event.preventDefault();
        if (!busy) onClose();
      }}
      className="fixed inset-0 m-auto max-h-[90dvh] w-[calc(100%-2rem)] max-w-xl overflow-y-auto rounded-xl border border-line bg-panel p-6 text-ink shadow-xl backdrop:bg-black/65">
      <div className="mb-5 flex items-center justify-between gap-4">
        <h2 id="todo-dialog-title" className="text-lg font-semibold">{title}</h2>
        <button type="button" disabled={busy} onClick={onClose} aria-label="閉じる" className="rounded px-2 py-1 text-muted hover:bg-elevated">✕</button>
      </div>
      {children}
    </dialog>
  );
}

export const fieldStyle = 'mt-1 block w-full rounded border border-line bg-canvas px-3 py-2 text-sm text-ink focus:border-accent focus:outline-none';
export const primaryStyle = 'rounded bg-accent px-4 py-2 text-sm font-semibold text-canvas hover:brightness-110 disabled:opacity-40';
export const secondaryStyle = 'rounded border border-line px-3 py-2 text-sm hover:bg-elevated disabled:opacity-40';
