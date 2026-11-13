import { useRef, useState } from 'react';
import { errorText } from '../lib/api';
import { fieldStyle, primaryStyle } from '../../../shared/components/Modal';

interface Props { onSend: (body: string, clientId: string) => Promise<void> }

/** @param props 投稿の保存操作。 @returns 日本語入力と再送に対応するテキスト入力。 */
export function Composer({ onSend }: Props) {
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const retry = useRef<{ body: string; id: string } | null>(null);
  const input = useRef<HTMLTextAreaElement>(null);
  /** 本文を保存し、失敗時は本文と再送IDを残す。 */
  async function submit() {
    if (busy || !body.trim()) return;
    setBusy(true);
    setError('');
    if (retry.current?.body !== body) retry.current = { body, id: crypto.randomUUID() };
    try {
      await onSend(body, retry.current.id);
      setBody('');
      retry.current = null;
    } catch (value) {
      setError(errorText(value));
    } finally {
      setBusy(false);
      input.current?.focus();
    }
  }
  return (
    <form className="border-t border-line p-4" onSubmit={/** @param event フォーム送信。Enter単独では送信しない。 */ (event) => {
      event.preventDefault();
      void submit();
    }}>
      <label htmlFor="chat-body" className="text-sm font-medium">メッセージ</label>
      <textarea id="chat-body" ref={input} value={body} disabled={busy} maxLength={2000} rows={3}
        placeholder="メッセージを入力…" className={`${fieldStyle} resize-y`}
        onChange={/** @param event 本文変更。 */ (event) => setBody(event.target.value)}
        onKeyDown={/** @param event キー操作。IME確定中の送信を防ぐ。 */ (event) => {
          if (event.key === 'Enter' && (event.ctrlKey || event.metaKey) && !event.nativeEvent.isComposing) {
            event.preventDefault();
            void submit();
          }
        }} />
      <div className="mt-2 flex flex-wrap items-center gap-2">
        {['👍', '😊', '🎉', '🙏', '❤️'].map(/** @param emoji 挿入する絵文字。 @returns 挿入ボタン。 */ (emoji) => (
          <button key={emoji} type="button" disabled={busy || body.length + emoji.length > 2000} aria-label={`${emoji} を入力`}
            className="rounded px-2 py-1 hover:bg-elevated disabled:opacity-40"
            onClick={/** 絵文字を本文末尾に追加する。 */ () => {
              setBody(body + emoji);
              input.current?.focus();
            }}>{emoji}</button>
        ))}
        <span className="ml-auto text-xs text-muted">{body.length}/2000</span>
        <button type="submit" disabled={busy || !body.trim()} className={primaryStyle}>{busy ? '送信中…' : '送信'}</button>
      </div>
      <p className="mt-1 text-xs text-muted">Enterで改行 / Ctrl・⌘ + Enterで送信</p>
      {error && <p role="alert" className="mt-2 text-sm text-danger">{error}</p>}
    </form>
  );
}
