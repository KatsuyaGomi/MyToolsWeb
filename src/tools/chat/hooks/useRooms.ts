import { useCallback, useEffect, useState } from 'react';
import type { ChatRoom } from '../../../../shared/chat';
import { chatApi, errorText } from '../lib/api';

export interface RoomDirectory {
  rooms: ChatRoom[];
  me: { id: string; name: string };
  isAdmin: boolean;
  pushKey: string | null;
}

/** @returns 所属先の部屋と、表示中30秒間隔で更新する操作。 */
export function useRooms() {
  const [directory, setDirectory] = useState<RoomDirectory | null>(null);
  const [error, setError] = useState('');
  const refresh = useCallback(/** 部屋一覧と未読件数を更新する。 */ async () => {
    try {
      setDirectory(await chatApi<RoomDirectory>('/rooms'));
      setError('');
    } catch (value) { setError(errorText(value)); }
  }, []);
  useEffect(/** 初回・再表示・30秒間隔で所属先を確認する。 @returns 監視の解除。 */ () => {
    /** 画面が表示されている間だけ通信する。 */
    function visibleRefresh() { if (!document.hidden) void refresh(); }
    visibleRefresh();
    const timer = window.setInterval(visibleRefresh, 30_000);
    document.addEventListener('visibilitychange', visibleRefresh);
    return /** タイマーとイベントを解除する。 */ () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', visibleRefresh);
    };
  }, [refresh]);
  return { directory, error, refresh };
}
