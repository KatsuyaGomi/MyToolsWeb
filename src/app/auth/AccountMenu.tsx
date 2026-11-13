import { useState } from 'react';
import { authClient } from './client';
import { disableNotifications } from '../../tools/chat';

/**
 * ログイン中の表示名とログアウト操作を表示する。
 * @returns ヘッダーに配置するアカウント情報。
 */
export function AccountMenu() {
  const { data } = authClient.useSession();
  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState('');

  /** サーバーのセッションを失効させ、ログイン画面に戻る。 */
  async function handleSignOut() {
    setIsBusy(true);
    setError('');
    try {
      try { await disableNotifications(); }
      catch { /* 通知解除の通信に失敗しても、セッションの失効を優先する。 */ }
      const result = await authClient.signOut();
      if (result.error) setError('ログアウトできませんでした。');
    } catch {
      setError('通信に失敗しました。');
    } finally {
      setIsBusy(false);
    }
  }

  return (
    <div className="flex min-w-0 items-center gap-3 pl-3">
      <span className="hidden max-w-32 truncate text-xs text-muted sm:block" title={data?.user.email}>{data?.user.name}</span>
      <button type="button" onClick={handleSignOut} disabled={isBusy} className="shrink-0 rounded border border-line px-2.5 py-1.5 text-xs hover:bg-elevated disabled:opacity-50">
        {isBusy ? '処理中…' : 'ログアウト'}
      </button>
      {error && <span role="alert" className="max-w-32 text-xs text-danger">{error}</span>}
    </div>
  );
}
