import { useState } from 'react';
import type { ChatMessage, ChatReader } from '../../../../shared/chat';
import { Modal, fieldStyle, primaryStyle, secondaryStyle } from '../../../shared/components/Modal';
import { errorText } from '../lib/api';

interface Props {
  message: ChatMessage;
  readers: ChatReader[];
  mine: boolean;
  admin: boolean;
  onChange: (message: ChatMessage, body: string | null) => Promise<void>;
}

/** @param props 対象投稿と権限。 @returns 編集・削除と、誰が読んだかの表示。 */
export function MessageActions({ message, readers, mine, admin, onChange }: Props) {
  const [mode, setMode] = useState<'edit' | 'delete' | 'read' | null>(null);
  const [body, setBody] = useState(message.body);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const titles = { read: '読んだ人', edit: 'メッセージの編集', delete: 'メッセージの削除' };
  const submitLabel = mode === 'delete' ? '削除する' : '保存';
  const seen = readers.filter(/** @param reader 部屋の参加者。 @returns 投稿者以外で表示済みか。 */ (reader) => reader.id !== message.authorId && reader.lastReadId >= message.id);
  /** @param next 開く操作。現在の本文を読み込み直す。 */
  function open(next: typeof mode) {
    setBody(message.body);
    setError('');
    setMode(next);
  }
  /** @returns 編集・削除を保存し、成功した場合だけ閉じる。 */
  async function save() {
    setBusy(true);
    try {
      await onChange(message, mode === 'delete' ? null : body);
      setMode(null);
    } catch (value) {
      setError(errorText(value));
    } finally {
      setBusy(false);
    }
  }
  /** ダイアログを閉じる。 */
  function close() { setMode(null); }
  return (
    <>
      <div className="mt-2 flex flex-wrap gap-3 text-xs text-muted">
        <button type="button" className="hover:text-accent underline-offset-2 hover:underline" onClick={/** 既読者一覧を開く。 */ () => open('read')}>既読 {seen.length}</button>
        {!message.deletedAt && mine && <button type="button" className="hover:text-accent" onClick={/** 編集を開く。 */ () => open('edit')}>編集</button>}
        {!message.deletedAt && (mine || admin) && <button type="button" className="hover:text-danger" onClick={/** 削除確認を開く。 */ () => open('delete')}>削除</button>}
      </div>
      {mode && <Modal title={titles[mode]} onClose={close} busy={busy}>
        {mode === 'read' ? (
          <>
            <p className="mb-3 text-sm text-muted">現在のグループ参加者のうち、この投稿まで表示した人です。</p>
            {seen.length ? <ul className="space-y-2">{seen.map(/** @param reader 閲覧済みの人。 @returns 表示名。 */ (reader) => <li key={reader.id}>{reader.name}</li>)}</ul>
              : <p className="text-sm text-muted">まだ既読者はいません。</p>}
          </>
        ) : (
          <>
            {mode === 'edit' ? <label className="text-sm">
              本文
              <textarea className={fieldStyle} rows={5} maxLength={2000} disabled={busy}
                value={body} onChange={/** @param event 編集後の本文。 */ (event) => setBody(event.target.value)} />
            </label>
              : <p className="text-sm">本文を削除します。この操作は元に戻せません。</p>}
            {error && <p role="alert" className="mt-3 text-sm text-danger">{error}</p>}
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" className={secondaryStyle} disabled={busy} onClick={close}>キャンセル</button>
              <button type="button" className={primaryStyle} disabled={busy || (mode === 'edit' && !body.trim())}
                onClick={save}>{busy ? '保存中…' : submitLabel}</button>
            </div>
          </>
        )}
      </Modal>}
    </>
  );
}
