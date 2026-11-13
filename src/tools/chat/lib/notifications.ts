import { chatApi, deviceId } from './api';

/** @returns このブラウザーで標準Push通知を使えるか。 */
export function supportsPush(): boolean {
  return isSecureContext && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
}

/** @param key 公開VAPID鍵。 @returns 購読APIへ渡すバイト列。 */
function decodeKey(key: string): Uint8Array<ArrayBuffer> {
  const value = atob(key.replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(value, /** @param char 鍵の1文字。 @returns バイト値。 */ (char) => char.charCodeAt(0));
}

/** @returns 現在のログインで有効な端末通知か。 */
export async function notificationEnabled(): Promise<boolean> {
  if (!supportsPush()) return false;
  const state = await chatApi<{ enabled: boolean }>(`/device?id=${deviceId()}`);
  return state.enabled;
}

/** @param key 公開VAPID鍵。利用者がボタンを押したときだけ許可を求め、端末を登録する。 */
export async function enableNotifications(key: string) {
  if (!supportsPush()) throw new Error('この環境では通知を利用できません。iPhoneはHTTPSで開き、ホーム画面に追加してください。');
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') throw new Error('通知が許可されていません。ブラウザーのサイト設定を確認してください。');
  const registration = await navigator.serviceWorker.register('/sw.js');
  await navigator.serviceWorker.ready;
  const previous = await registration.pushManager.getSubscription();
  // 別アカウントや以前の鍵の購読を引き継がず、明示操作で登録し直す。
  if (previous) await previous.unsubscribe();
  const subscription = await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: decodeKey(key) });
  try {
    await chatApi('/device', { method: 'POST', body: JSON.stringify({ id: deviceId(), subscription: subscription.toJSON() }) });
  } catch (value) {
    await subscription.unsubscribe();
    throw value;
  }
}

/** 通知を解除する。サーバー側の解除に失敗した場合はエラーを返す。 */
export async function disableNotifications() {
  await chatApi('/device', { method: 'DELETE', body: JSON.stringify({ id: deviceId() }) });
  if (!supportsPush()) return;
  const registration = await navigator.serviceWorker.getRegistration('/');
  const subscription = await registration?.pushManager.getSubscription();
  await subscription?.unsubscribe();
  const notifications = await registration?.getNotifications();
  for (const notification of notifications ?? []) notification.close();
}
