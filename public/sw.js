/** @param event 通知データ。セッションと端末の一致を確認してから表示する。 */
self.addEventListener('push', (event) => {
  event.waitUntil(showPush(event));
});

/** @param event 受信したPush。 @returns 通知表示の完了。 */
async function showPush(event) {
  if (!event.data) return;
  const data = event.data.json();
  if (typeof data.deviceId !== 'string' || typeof data.roomId !== 'string' || typeof data.userId !== 'string') return;
  // アカウント切替や失効後に、以前の利用者向け本文を表示しない。
  const response = await fetch(`/api/chat/device?id=${encodeURIComponent(data.deviceId)}&room=${encodeURIComponent(data.roomId)}`, { cache: 'no-store' });
  if (!response.ok) return;
  const state = await response.json();
  if (!state.enabled || state.userId !== data.userId) return;
  await self.registration.showNotification(String(data.title), {
    body: String(data.body), icon: '/icon.svg', tag: `chat-${data.messageId}`,
    data: { roomId: data.roomId },
  });
}

/** @param event 通知クリック。部屋のページへ移動する。 */
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(openRoom(event.notification.data?.roomId));
});

/** @param roomId 部屋ID。 @returns 既存タブのフォーカスまたは新規タブの作成。 */
async function openRoom(roomId) {
  if (typeof roomId !== 'string' || !/^[\w-]{1,64}$/.test(roomId)) return;
  const url = new URL(`/tools/chat?room=${encodeURIComponent(roomId)}`, self.location.origin).href;
  const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
  for (const client of windows) {
    if (new URL(client.url).origin === self.location.origin) {
      await client.navigate(url);
      await client.focus();
      return;
    }
  }
  await self.clients.openWindow(url);
}

/** @param event 新規Service Worker。待機中に残さず通知処理を更新する。 */
self.addEventListener('install', (event) => event.waitUntil(self.skipWaiting()));
/** @param event 更新後のService Worker。既存ページの通知操作を有効にする。 */
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));
