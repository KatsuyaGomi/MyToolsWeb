import { useState } from 'react';
import { useRooms } from '../hooks/useRooms';
import { chatApi, errorText } from '../lib/api';
import { Conversation } from '../components/Conversation';
import { NotificationSettings } from '../components/NotificationSettings';
import { secondaryStyle } from '../../../shared/components/Modal';

/** @returns 所属グループごとのチャットと端末の通知設定。 */
export function ChatPage() {
  const { directory, error, refresh } = useRooms();
  const [selected, setSelected] = useState(new URLSearchParams(window.location.search).get('room') ?? '');
  const [muteError, setMuteError] = useState('');
  const [busy, setBusy] = useState(false);
  const room = directory?.rooms.find(/** @param item 部屋。 @returns 選択中か。 */ (item) => item.id === selected) ?? directory?.rooms[0];
  /** @param id 部屋ID。通知からの直接アクセスと同じURLを維持する。 */
  function select(id: string) {
    setSelected(id);
    history.replaceState(null, '', `/tools/chat?room=${id}`);
    setMuteError('');
  }
  /** 選択中のグループの通知だけを切り替える。 */
  async function mute() {
    if (!room) return;
    setBusy(true);
    try {
      await chatApi(`/rooms/${room.id}/mute`, { method: 'PUT', body: JSON.stringify({ muted: !room.muted }) });
      await refresh();
      setMuteError('');
    } catch (value) { setMuteError(errorText(value)); }
    finally { setBusy(false); }
  }
  return (
    <div className="mx-auto flex h-[calc(100dvh-4rem)] max-w-7xl flex-col p-3 sm:p-6">
      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h1 className="text-2xl font-semibold">グループチャット</h1>
          <p className="mt-1 text-sm text-muted">同じグループのメンバーと会話できます。</p>
        </div>
        {room && <button type="button" disabled={busy} className={secondaryStyle} onClick={mute}>{room.muted ? 'グループの通知：ミュート中' : 'グループの通知：有効'}</button>}
      </div>
      {(error || muteError) && <p role="alert" className="mb-3 text-sm text-danger">{error || muteError}</p>}
      {!directory ? <p role="status" className="text-muted">部屋を読み込んでいます…</p> : (
        <div className="flex min-h-0 flex-1 flex-col gap-4 lg:flex-row">
          <aside className="flex shrink-0 flex-col gap-3 lg:w-56" aria-label="部屋と通知設定">
            <div className="lg:hidden">
              <label htmlFor="chat-room" className="text-xs text-muted">部屋</label>
              <select id="chat-room" className="ml-3 rounded border border-line bg-panel p-2 text-sm" value={room?.id ?? ''}
                onChange={/** @param event 選択した部屋。 */ (event) => select(event.target.value)}>
                {directory.rooms.map(/** @param item 部屋。 @returns 選択肢。 */ (item) => <option key={item.id} value={item.id}>{item.name}{item.unread > 0 ? `（未読 ${item.unread}）` : ''}</option>)}
              </select>
            </div>
            <nav className="hidden max-h-60 space-y-2 overflow-y-auto lg:block" aria-label="所属グループの部屋">
              {directory.rooms.map(/** @param item 部屋。 @returns 選択用ボタン。 */ (item) => (
                <button key={item.id} type="button" aria-current={room?.id === item.id ? 'page' : undefined}
                  className={`flex w-full items-center justify-between gap-2 rounded-lg border px-3 py-3 text-left text-sm ${room?.id === item.id ? 'border-accent bg-selection' : 'border-line bg-panel hover:bg-elevated'}`}
                  onClick={/** 部屋を切り替える。 */ () => select(item.id)}>
                  <span className="break-all">{item.name}{item.muted && <span className="block text-xs text-muted">ミュート中</span>}</span>
                  {item.unread > 0 && <span className="rounded-full bg-accent px-2 text-xs font-bold text-canvas" aria-label={`未読 ${item.unread}件`}>{item.unread}</span>}
                </button>
              ))}
            </nav>
            <NotificationSettings pushKey={directory.pushKey} />
          </aside>
          {room ? <Conversation key={room.id} room={room} userId={directory.me.id} admin={directory.isAdmin} onRead={refresh} />
            : <div className="rounded-xl border border-line bg-panel p-8 text-sm text-muted">所属グループがありません。管理者にグループへの追加を依頼してください。</div>}
        </div>
      )}
    </div>
  );
}
