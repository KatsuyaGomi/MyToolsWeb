import { isOwnerAdmin } from '../auth/adminApi.ts';
import type { AuthSession } from '../http/types.ts';
import type { Env } from '../env.ts';
import { readDirectory, saveGroupChange } from './repository.ts';
import type { GroupChange } from './repository.ts';

interface Target { groupId?: string; userId?: string }

/** @param value 未検証値。 @returns 有効な識別子か。 */
function validId(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= 64;
}

/** @param request 要求。 @returns 上限付きのJSON。 @throws 不正なJSONや16KB超過。 */
async function readBody(request: Request): Promise<Record<string, unknown>> {
  const reader = request.body?.getReader();
  if (!reader) throw new Error('入力がありません。');
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const part = await reader.read();
    if (part.done) break;
    size += part.value.length;
    if (size > 16_000) {
      await reader.cancel();
      throw new Error('入力が大きすぎます。');
    }
    chunks.push(part.value);
  }
  const value: unknown = JSON.parse(await new Blob(chunks).text());
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('入力形式が不正です。');
  return value as Record<string, unknown>;
}

/**
 * 管理者本人だけがグループと複数所属を設定できるAPI。
 * @param request HTTP要求。
 * @param env D1と管理者設定。
 * @param session 検証済みセッション。
 * @param target 操作対象。未指定なら一覧・作成。
 * @returns 設定結果または認可・入力・競合エラー。
 */
export async function handleGroups(request: Request, env: Env, session: AuthSession, target: Target = {}): Promise<Response> {
  const headers = { 'Cache-Control': 'no-store' };
  /** @param body 応答内容。 @param status HTTP状態。 @returns キャッシュしないJSON。 */
  function json(body: unknown, status = 200) {
    return Response.json(body, { status, headers });
  }
  if (!isOwnerAdmin(session, env)) return json({ error: '管理者本人のみ利用できます。' }, 403);
  const allowed = target.userId ? ['PUT'] : target.groupId ? ['PUT', 'DELETE'] : ['GET', 'POST'];
  if (!allowed.includes(request.method)) {
    return Response.json({ error: '対応していない操作です。' }, { status: 405, headers: { ...headers, Allow: allowed.join(', ') } });
  }
  if (request.method !== 'GET' && request.headers.get('Origin') !== new URL(env.BETTER_AUTH_URL!).origin) {
    return json({ error: '許可されていないアクセス元です。' }, 403);
  }
  const db = env.DB!;
  if (request.method === 'GET') {
    const userIds = [...new Set(new URL(request.url).searchParams.getAll('userId'))];
    if (userIds.length > 100 || !userIds.every(validId)) return json({ error: '対象ユーザーが不正です。' }, 400);
    return json(await readDirectory(db, userIds));
  }
  try {
    const body = await readBody(request);
    if (!Number.isSafeInteger(body.revision) || Number(body.revision) < 0) return json({ error: '設定の版番号が不正です。' }, 400);
    const current = await readDirectory(db, []);
    if (body.revision !== current.revision) return json({ error: '別の操作で更新されました。再読み込みして操作してください。' }, 409);
    let change: GroupChange;
    if (target.userId) {
      if (!validId(target.userId) || !await db.prepare('SELECT id FROM "user" WHERE id = ?').bind(target.userId).first()) {
        return json({ error: 'ユーザーが見つかりません。' }, 404);
      }
      if (!Array.isArray(body.groupIds) || body.groupIds.length > 30 || !body.groupIds.every(validId)) return json({ error: '所属先が不正です。' }, 400);
      const groupIds = [...new Set(body.groupIds as string[])];
      const known = new Set(current.groups.map(/** @param group 候補。 @returns ID。 */ (group) => group.id));
      if (!groupIds.every(/** @param id 選択先。 @returns 存在するか。 */ (id) => known.has(id))) return json({ error: '存在しないグループです。' }, 400);
      change = { kind: 'membership', userId: target.userId, groupIds };
    } else if (target.groupId) {
      if (!current.groups.some(/** @param group 候補。 @returns 対象か。 */ (group) => group.id === target.groupId)) return json({ error: 'グループが見つかりません。' }, 404);
      if (request.method === 'DELETE') change = { kind: 'delete', id: target.groupId };
      else {
        if (typeof body.name !== 'string' || !body.name.trim() || body.name.length > 60) return json({ error: 'グループ名は1〜60文字で入力してください。' }, 400);
        change = { kind: 'rename', id: target.groupId, name: body.name.trim() };
      }
    } else {
      if (current.groups.length >= 30) return json({ error: 'グループは30件までです。' }, 400);
      if (typeof body.name !== 'string' || !body.name.trim() || body.name.length > 60) return json({ error: 'グループ名は1〜60文字で入力してください。' }, 400);
      change = { kind: 'create', id: crypto.randomUUID(), name: body.name.trim() };
    }
    if (!await saveGroupChange(db, Number(body.revision), change)) return json({ error: '設定が更新されました。再読み込みしてください。' }, 409);
    return json({ ok: true }, request.method === 'POST' ? 201 : 200);
  } catch {
    return json({ error: '保存できませんでした。入力形式・グループ名の重複を確認してください。' }, 400);
  }
}
