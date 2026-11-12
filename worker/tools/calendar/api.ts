import { changeEvent, createEvent, listEvents } from './repository.ts';
import { parseEvent, parseRange } from './validation.ts';

/**
 * 認証後のカレンダー操作を振り分ける。Publicもログイン済み利用者だけが閲覧できる。
 * @param request HTTP要求。
 * @param db D1接続。
 * @param userId 確認済みのセッション所有者。
 * @returns 入力検証・認可を経たJSON応答。
 */
export async function handleCalendar(request: Request, db: D1Database, userId: string): Promise<Response> {
  const headers = { 'Cache-Control': 'no-store', Allow: 'GET, POST, PUT, DELETE' };
  /** @param value 応答内容。 @param status HTTPコード。 @returns キャッシュしないJSON。 */
  function json(value: unknown, status = 200) {
    return Response.json(value, { status, headers });
  }
  if (!['GET', 'POST', 'PUT', 'DELETE'].includes(request.method)) return json({ error: '対応していない操作です。' }, 405);
  if (request.method !== 'GET' && request.headers.get('Origin') !== new URL(request.url).origin) {
    return json({ error: '送信元が一致しません。' }, 403);
  }
  try {
    if (request.method === 'GET') {
      const range = parseRange(new URL(request.url));
      if (!range) return json({ error: '期間または表示範囲が不正です（最大62日）。' }, 400);
      const events = await listEvents(db, userId, range);
      if (events.length > 500) return json({ error: '表示対象が500件を超えています。「自分の予定のみ」に切り替えてください。' }, 422);
      return json({ events });
    }
    const reader = request.body?.getReader();
    if (!reader) return json({ error: '入力がありません。' }, 400);
    const chunks: Uint8Array[] = [];
    let size = 0;
    while (true) {
      const part = await reader.read();
      if (part.done) break;
      size += part.value.byteLength;
      if (size > 32_000) {
        await reader.cancel();
        return json({ error: '入力が大きすぎます。' }, 413);
      }
      chunks.push(part.value);
    }
    let body: Record<string, unknown>;
    try {
      const value: unknown = JSON.parse(await new Blob(chunks).text());
      if (typeof value !== 'object' || value === null || Array.isArray(value)) return json({ error: '入力形式が不正です。' }, 400);
      body = value as Record<string, unknown>;
    } catch {
      return json({ error: 'JSON形式が不正です。' }, 400);
    }
    if (request.method === 'POST') {
      const input = parseEvent(body);
      if (!input) return json({ error: 'タイトル・公開範囲・日時を確認してください。日時は5分単位で、終了を開始より後にしてください。' }, 400);
      return json({ id: await createEvent(db, userId, input) }, 201);
    }
    if (typeof body.id !== 'string' || !body.id || body.id.length > 64 || !Number.isSafeInteger(body.revision) || Number(body.revision) < 0) {
      return json({ error: '予定のIDまたは版番号が不正です。' }, 400);
    }
    const input = request.method === 'PUT' ? parseEvent(body) : null;
    if (request.method === 'PUT' && !input) return json({ error: '入力を確認してください。日時は5分単位で、終了を開始より後にしてください。' }, 400);
    const status = await changeEvent(db, userId, body.id, Number(body.revision), input);
    if (status === 404) return json({ error: '予定が見つからないか、変更する権限がありません。' }, 404);
    if (status === 409) return json({ error: '別の端末で更新されています。閉じて再読み込みし、最新の予定から操作してください。' }, 409);
    return json({ ok: true });
  } catch {
    return json({ error: '予定を保存・取得できません。時間をおいて再度お試しください。' }, 503);
  }
}
