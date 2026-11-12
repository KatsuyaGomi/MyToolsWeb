import { readBoard, writeBoard } from './repository.ts';
import { parseBoard } from './validation.ts';

/**
 * 個人のTodoを読み書きする。所有者IDは必ず確認済みセッションから渡す。
 * @param request HTTP要求。
 * @param db D1接続。
 * @param userId 認証済みユーザーID。
 * @returns ボードまたは入力・競合・保存エラー。
 */
export async function handleTodo(request: Request, db: D1Database, userId: string): Promise<Response> {
  const headers = { 'Cache-Control': 'no-store', Allow: 'GET, PUT' };
  if (request.method !== 'GET' && request.method !== 'PUT') {
    return Response.json({ error: '対応していない操作です。' }, { status: 405, headers });
  }
  if (request.method === 'PUT' && request.headers.get('Origin') !== new URL(request.url).origin) {
    return Response.json({ error: '送信元が一致しません。' }, { status: 403, headers });
  }
  try {
    if (request.method === 'GET') return Response.json(await readBoard(db, userId), { headers });
    // 最大500件のボードでも、無制限のリクエスト本文は受け付けない。
    const reader = request.body?.getReader();
    if (!reader) return Response.json({ error: 'データがありません。' }, { status: 400, headers });
    const chunks: Uint8Array[] = [];
    let size = 0;
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      size += chunk.value.byteLength;
      if (size > 1_000_000) {
        await reader.cancel();
        return Response.json({ error: '保存データはボード全体で1MBまでです。説明を短くするか不要なタスクを削除してください。' }, { status: 413, headers });
      }
      chunks.push(chunk.value);
    }
    let value: unknown;
    try {
      value = JSON.parse(await new Blob(chunks).text());
    } catch {
      return Response.json({ error: 'JSON形式を確認してください。' }, { status: 400, headers });
    }
    const board = parseBoard(value);
    if (!board) return Response.json({ error: '入力内容・件数の上限を確認してください。' }, { status: 400, headers });
    const saved = await writeBoard(db, userId, board);
    if (!saved) return Response.json({ error: '別の端末で更新されています。最新の内容を読み込みました。' }, { status: 409, headers });
    return Response.json(saved, { headers });
  } catch {
    return Response.json({ error: 'Todoを保存・取得できません。時間をおいて再度お試しください。' }, { status: 503, headers });
  }
}
