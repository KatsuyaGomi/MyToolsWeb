import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { ChatRoom } from '../../../../shared/chat';
import { useMessages } from '../hooks/useMessages';
import { chatApi, errorText } from '../lib/api';
import { Composer } from './Composer';
import { MessageActions } from './MessageActions';
import { secondaryStyle } from '../../../shared/components/Modal';

interface Props {
  room: ChatRoom;
  userId: string;
  admin: boolean;
  onRead: () => Promise<void>;
}

/** @param props 部屋・現在の利用者。 @returns 履歴と入力をまとめた作業領域。 */
export function Conversation({ room, userId, admin, onRead }: Props) {
  const chat = useMessages(room.id);
  const scroll = useRef<HTMLDivElement>(null);
  const atBottom = useRef(true);
  const oldest = useRef<number | undefined>(undefined);
  const previousHeight = useRef(0);
  const lastRead = useRef(0);
  const [following, setFollowing] = useState(true);
  const [readError, setReadError] = useState('');
  const latestId = chat.messages.at(-1)?.id ?? 0;
  const myRead = chat.readers.find(/** @param reader 参加者。 @returns 自分の既読位置か。 */ (reader) => reader.id === userId)?.lastReadId ?? 0;

  /** 表示中かつ末尾まで閲覧したときだけ既読を進める。失敗時は次回再試行する。 */
  async function markVisible() {
    if (document.hidden || !atBottom.current || latestId <= Math.max(lastRead.current, myRead) || chat.revoked || chat.loading) return;
    const before = lastRead.current;
    lastRead.current = latestId;
    try {
      await chatApi(`/rooms/${room.id}/read`, { method: 'POST', body: JSON.stringify({ messageId: latestId }) });
      setReadError('');
      await onRead();
    } catch (value) {
      lastRead.current = before;
      setReadError(errorText(value));
    }
  }
  useLayoutEffect(/** 新着時は末尾追従、過去分の追加時は閲覧位置を保持する。 */ () => {
    const element = scroll.current;
    if (!element) return;
    const nextOldest = chat.messages[0]?.id;
    if (oldest.current !== undefined && nextOldest !== oldest.current) {
      element.scrollTop += element.scrollHeight - previousHeight.current;
    } else if (atBottom.current) element.scrollTop = element.scrollHeight;
    oldest.current = nextOldest;
    previousHeight.current = element.scrollHeight;
    void markVisible();
  });
  useEffect(/** 再表示した際にも既読を確認する。 @returns 監視解除。 */ () => {
    document.addEventListener('visibilitychange', markVisible);
    return /** 表示イベントを解除する。 */ () => document.removeEventListener('visibilitychange', markVisible);
  });
  /** スクロール位置から追従状態と既読を更新する。 */
  function onScroll() {
    const element = scroll.current;
    if (!element) return;
    atBottom.current = element.scrollHeight - element.scrollTop - element.clientHeight < 36;
    setFollowing(atBottom.current);
    void markVisible();
  }
  /** 最新へ移動する。 */
  function jump() {
    atBottom.current = true;
    scroll.current?.scrollTo({ top: scroll.current.scrollHeight });
    setFollowing(true);
    void markVisible();
  }
  return (
    <section className="flex min-h-0 min-w-0 flex-1 flex-col rounded-xl border border-line bg-panel" aria-label={`${room.name} のチャット`}>
      <header className="flex items-center justify-between gap-3 border-b border-line px-4 py-3">
        <div>
          <h2 className="font-semibold">{room.name}</h2>
          <p className="text-xs text-muted">グループのメンバー限定 / 5秒間隔で更新</p>
        </div>
        <button type="button" className={secondaryStyle} onClick={chat.refresh} disabled={chat.loading}>更新</button>
      </header>
      {(chat.error || readError) && <p role="alert" className="border-b border-line px-4 py-2 text-sm text-danger">{chat.error || readError}</p>}
      <div ref={scroll} onScroll={onScroll} className="min-h-48 flex-1 space-y-4 overflow-y-auto p-4" tabIndex={0} aria-label="メッセージ履歴">
        {chat.hasMore && <button type="button" className={`${secondaryStyle} w-full`} onClick={chat.older} disabled={chat.loading}>過去のメッセージを読み込む</button>}
        {chat.loading && !chat.messages.length && <p role="status" className="text-sm text-muted">読み込み中…</p>}
        {!chat.loading && !chat.messages.length && !chat.revoked && <p className="py-10 text-center text-sm text-muted">最初のメッセージを送ってみましょう。</p>}
        {chat.messages.map(/** @param message 投稿。 @returns 投稿者・本文・既読・操作。 */ (message) => (
          <article key={message.id} className={`rounded-lg border border-line p-3 ${message.authorId === userId ? 'bg-selection/40' : 'bg-canvas/50'}`}>
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <span className="text-sm font-semibold">{message.authorName}{message.authorId === userId && '（自分）'}</span>
              <time dateTime={new Date(message.createdAt).toISOString()} className="text-xs text-muted">{new Date(message.createdAt).toLocaleString('ja-JP')}</time>
              {message.editedAt && !message.deletedAt && <span className="text-xs text-muted">編集済み</span>}
            </div>
            <p className={`mt-2 whitespace-pre-wrap break-words text-sm leading-6 ${message.deletedAt ? 'italic text-muted' : ''}`}>
              {message.deletedAt ? 'メッセージは削除されました' : message.body}
            </p>
            <MessageActions message={message} readers={chat.readers} mine={message.authorId === userId} admin={admin} onChange={chat.change} />
          </article>
        ))}
      </div>
      {!following && <button type="button" onClick={jump} className="border-t border-line py-2 text-sm text-accent hover:bg-elevated">↓ 最新のメッセージへ</button>}
      {!chat.revoked && <Composer onSend={chat.send} />}
    </section>
  );
}
