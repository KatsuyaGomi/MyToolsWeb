import { useEffect, useRef } from 'react';
import type { ReactNode } from 'react';

interface Props {
  title: string;
  children: ReactNode;
  onClose: () => void;
  busy: boolean;
}

/**
 * 共通のネイティブダイアログ。閉じると起点へフォーカスを戻す。
 * @param props 見出し、内容、終了操作と保存状態。
 * @returns モーダル画面。
 */
export function Modal({ title, children, onClose, busy }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(/** モーダルを開く。 @returns 終了時のフォーカス復帰。 */ () => {
    const previous = document.activeElement;
    const dialog = ref.current;
    dialog?.showModal();
    return /** モーダルを閉じてフォーカスを戻す。 */ () => {
      dialog?.close();
      if (previous instanceof HTMLElement && previous.isConnected) previous.focus();
    };
  }, []);
  return (
    <dialog ref={ref} aria-labelledby="tool-modal-title"
      onCancel={/** 保存中は閉じない。 @param event キャンセル操作。 */ (event) => {
        event.preventDefault();
        if (!busy) onClose();
      }}
      className="fixed inset-0 m-auto max-h-[90dvh] w-[calc(100%-2rem)] max-w-xl overflow-y-auto rounded-xl border border-line bg-panel p-6 text-ink shadow-xl backdrop:bg-black/65">
      <div className="mb-5 flex items-center justify-between gap-4">
        <h2 id="tool-modal-title" className="text-lg font-semibold">{title}</h2>
        <button type="button" disabled={busy} onClick={onClose} aria-label="閉じる" className="rounded px-2 py-1 text-muted hover:bg-elevated">✕</button>
      </div>
      {children}
    </dialog>
  );
}

export const fieldStyle = 'mt-1 block w-full rounded border border-line bg-canvas px-3 py-2 text-sm text-ink focus:border-accent focus:outline-none';
export const primaryStyle = 'rounded bg-accent px-4 py-2 text-sm font-semibold text-canvas hover:brightness-110 disabled:opacity-40';
export const secondaryStyle = 'rounded border border-line px-3 py-2 text-sm hover:bg-elevated disabled:opacity-40';
