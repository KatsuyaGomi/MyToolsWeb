import { useEffect, useState } from 'react';

/**
 * 管理者メニューの表示可否をサーバーの判定から取得する。
 * @returns 管理者本人の場合に真。権限の強制はAPI側でも行う。
 */
export function useAdminAccess() {
  const [isAdmin, setIsAdmin] = useState(false);
  /** 管理者判定を取得し、画面終了時には未完了の通信を中断する。 */
  useEffect(function loadAdminAccess() {
    const controller = new AbortController();
    /** サーバーが確認した管理者フラグだけを表示に使う。 */
    async function load() {
      try {
        const response = await fetch('/api/me', { signal: controller.signal });
        const data = await response.json() as { isAdmin?: boolean };
        if (!controller.signal.aborted) setIsAdmin(response.ok && data.isAdmin === true);
      } catch {
        if (!controller.signal.aborted) setIsAdmin(false);
      }
    }
    void load();
    /** 終了済みのコンポーネントへ応答を反映しないようにする。 */
    return function cancelLoad() { controller.abort(); };
  }, []);
  return isAdmin;
}
