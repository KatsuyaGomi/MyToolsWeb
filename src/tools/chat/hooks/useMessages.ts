import { useCallback, useEffect, useRef, useState } from 'react';
import type { ChatMessage, ChatReader, ChatSnapshot } from '../../../../shared/chat';
import { chatApi, ChatError, deviceId, errorText } from '../lib/api';

/** @param previous 現在の投稿。 @param incoming 取得した投稿。 @returns ID順で重複のない投稿。 */
function mergeMessages(previous: ChatMessage[], incoming: ChatMessage[]): ChatMessage[] {
  const records = new Map(previous.map(/** @param message 投稿。 @returns IDと投稿の組。 */ (message) => [message.id, message]));
  for (const message of incoming) {
    const current = records.get(message.id);
    if (!current || message.revision >= current.revision) records.set(message.id, message);
  }
  return [...records.values()].sort(/** @param a 投稿。 @param b 投稿。 @returns IDの昇順。 */ (a, b) => a.id - b.id);
}

/** @param roomId 閲覧する部屋。 @returns 履歴、差分の監視、投稿操作。 */
export function useMessages(roomId: string) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [readers, setReaders] = useState<ChatReader[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [revoked, setRevoked] = useState(false);
  const version = useRef<number | null>(null);
  const pending = useRef(false);
  const alive = useRef(true);
  const abort = useRef<AbortController | null>(null);

  const refresh = useCallback(/** @returns 最新差分を取得し、削除・編集も反映する。 */ async () => {
    if (pending.current || document.hidden || !alive.current) return;
    pending.current = true;
    const controller = new AbortController();
    abort.current = controller;
    try {
      let more = true;
      while (more && !controller.signal.aborted) {
        const initial = version.current === null;
        const query = new URLSearchParams({ device: deviceId() });
        if (!initial) query.set('since', String(version.current));
        const snapshot = await chatApi<ChatSnapshot>(`/rooms/${roomId}/messages?${query}`, { signal: controller.signal });
        if (controller.signal.aborted || !alive.current) return;
        setMessages(/** @param previous 読み込み済み投稿。 @returns 差分を結合した投稿。 */ (previous) => mergeMessages(previous, snapshot.messages));
        setReaders(snapshot.readers);
        if (initial) setHasMore(snapshot.hasMore);
        version.current = snapshot.version;
        more = !initial && snapshot.hasMore;
      }
      setError('');
    } catch (value) {
      if (!controller.signal.aborted && alive.current) {
        setError(errorText(value));
        if (value instanceof ChatError && [401, 404].includes(value.status)) {
          setMessages([]);
          setReaders([]);
          setRevoked(true);
        }
      }
    } finally {
      pending.current = false;
      if (alive.current) setLoading(false);
    }
  }, [roomId]);

  useEffect(/** 部屋表示中だけ5秒間隔で差分を読む。 @returns 画面終了時の通信停止。 */ () => {
    alive.current = true;
    void refresh();
    /** 非表示・終了・部屋切替では、現在の部屋の通知抑制を解除する。 */
    function clearPresence() {
      abort.current?.abort();
      void fetch('/api/chat/presence', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: deviceId(), roomId }), keepalive: true }).catch(/** 終了時の通信失敗は次回の有効期限で解消する。 */ () => undefined);
    }
    /** 再表示では即時更新し、非表示では通信を中断する。 */
    function visibility() {
      if (!document.hidden) void refresh();
      else clearPresence();
    }
    const timer = setInterval(refresh, 5000);
    document.addEventListener('visibilitychange', visibility);
    window.addEventListener('pagehide', clearPresence);
    window.addEventListener('focus', refresh);
    return /** 差分監視を解除し、古い部屋の応答を破棄する。 */ () => {
      alive.current = false;
      abort.current?.abort();
      clearPresence();
      clearInterval(timer);
      document.removeEventListener('visibilitychange', visibility);
      window.removeEventListener('pagehide', clearPresence);
      window.removeEventListener('focus', refresh);
    };
  }, [refresh]);

  /** @returns 過去50件を追加する。差分カーソルは巻き戻さない。 */
  async function older() {
    if (!messages.length || loading) return;
    setLoading(true);
    try {
      const snapshot = await chatApi<ChatSnapshot>(`/rooms/${roomId}/messages?before=${messages[0].id}`);
      if (!alive.current) return;
      setMessages(/** @param previous 現在の履歴。 @returns 過去分を追加した履歴。 */ (previous) => mergeMessages(previous, snapshot.messages));
      setHasMore(snapshot.hasMore);
    } catch (value) { if (alive.current) setError(errorText(value)); }
    finally { if (alive.current) setLoading(false); }
  }

  /** @param body 本文。 @param clientId 再送でも維持するID。 @returns 保存の完了。 */
  async function send(body: string, clientId: string) {
    const result = await chatApi<{ message: ChatMessage }>(`/rooms/${roomId}/messages`, {
      method: 'POST', body: JSON.stringify({ body, clientId }),
    });
    if (alive.current) setMessages(/** @param previous 履歴。 @returns 自分の投稿を追加した履歴。 */ (previous) => mergeMessages(previous, [result.message]));
    await refresh();
  }

  /** @param message 対象。 @param body 編集後の本文。nullは削除。 @returns 更新の完了。 */
  async function change(message: ChatMessage, body: string | null) {
    await chatApi(`/rooms/${roomId}/messages/${message.id}`, {
      method: body === null ? 'DELETE' : 'PUT', body: JSON.stringify({ revision: message.revision, body }),
    });
    await refresh();
  }
  return { messages, readers, hasMore, loading, error, revoked, refresh, older, send, change };
}
