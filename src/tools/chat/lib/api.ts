/** @param path チャット内のパス。 @param init 通信条件。 @returns 検証済みJSON。 @throws APIの説明付きエラー。 */
export async function chatApi<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`/api/chat${path}`, {
    ...init, headers: { 'Content-Type': 'application/json', ...init?.headers },
  });
  const result = await response.json();
  if (!response.ok) throw new ChatError(result.error ?? '通信に失敗しました。', response.status);
  return result as T;
}

export class ChatError extends Error {
  /** @param message 画面に表示する説明。 @param status HTTPステータス。 */
  constructor(message: string, public status: number) { super(message); }
}

/** @returns このブラウザーの通知購読を識別する補助ID。 */
export function deviceId(): string {
  let id = localStorage.getItem('chat-device');
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem('chat-device', id);
  }
  return id;
}

/** @param value 捕捉した例外。 @returns 利用者向けの説明。 */
export function errorText(value: unknown): string {
  return value instanceof Error ? value.message : '通信に失敗しました。';
}
