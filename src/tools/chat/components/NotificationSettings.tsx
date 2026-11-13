import { useEffect, useState } from 'react';
import { disableNotifications, enableNotifications, notificationEnabled, supportsPush } from '../lib/notifications';
import { errorText } from '../lib/api';
import { secondaryStyle } from '../../../shared/components/Modal';

/** @param props 通知用公開鍵。 @returns 端末ごとの明示的な通知登録・解除。 */
export function NotificationSettings({ pushKey }: { pushKey: string | null }) {
  const [enabled, setEnabled] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [expanded, setExpanded] = useState(false);
  const actionLabel = enabled ? '通知を無効にする' : '通知を有効にする';
  useEffect(/** 現在のセッションでの登録を調べる。 */ () => {
    void notificationEnabled().then(/** @param value 現在の登録状態。 */ (value) => setEnabled(value))
      .catch(/** @param value 確認時の失敗。 */ (value: unknown) => setError(errorText(value)));
  }, []);
  /** 利用者の操作で通知を切り替える。 */
  async function toggle() {
    setBusy(true);
    setError('');
    try {
      if (enabled) await disableNotifications();
      else if (pushKey) await enableNotifications(pushKey);
      setEnabled(!enabled);
    } catch (value) { setError(errorText(value)); }
    finally { setBusy(false); }
  }
  return (
    <div>
      <button type="button" className="text-xs text-accent lg:hidden" aria-expanded={expanded} aria-controls="chat-notification-settings"
        onClick={/** 小さい画面の通知設定を開閉する。 */ () => setExpanded(!expanded)}>端末の通知設定 {expanded ? '▴' : '▾'}</button>
      <div id="chat-notification-settings" className={`${expanded ? 'block' : 'hidden'} mt-2 rounded-lg border border-line bg-panel p-3 text-xs lg:mt-0 lg:block`}>
      <p className="mb-2 font-medium">この端末の通知：{enabled ? '有効' : '無効'}</p>
      <button type="button" className={secondaryStyle} disabled={busy || !pushKey || !supportsPush()} onClick={toggle}>
        {busy ? '処理中…' : actionLabel}
      </button>
      <p className="mt-2 leading-5 text-muted">送信者名と本文を通知します。iPhoneはホーム画面への追加が必要です。ログアウトすると解除されます。</p>
      {!pushKey && <p className="mt-2 text-muted">管理者による通知用の鍵設定が必要です。</p>}
      {!supportsPush() && <p className="mt-2 text-muted">この環境では通知を利用できません。HTTPS・対応ブラウザーを確認してください。</p>}
      {error && <p role="alert" className="mt-2 text-danger">{error}</p>}
      </div>
    </div>
  );
}
