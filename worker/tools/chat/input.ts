import { HTTPException } from 'hono/http-exception';

/** @param request 要求。 @returns 16KB以下のJSONオブジェクト。 @throws 入力形式・容量エラー。 */
export async function readChatBody(request: Request): Promise<Record<string, unknown>> {
  const reader = request.body?.getReader();
  if (!reader) throw new HTTPException(400, { message: '入力がありません。' });
  let size = 0;
  const parts: Uint8Array[] = [];
  while (true) {
    const part = await reader.read();
    if (part.done) break;
    size += part.value.length;
    if (size > 16_000) {
      await reader.cancel();
      throw new HTTPException(413, { message: '入力が大きすぎます。' });
    }
    parts.push(part.value);
  }
  try {
    const data: unknown = JSON.parse(await new Blob(parts).text());
    if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error();
    return data as Record<string, unknown>;
  } catch {
    throw new HTTPException(400, { message: '入力形式が不正です。' });
  }
}

/** @param value 入力値。 @returns 検証済み本文。 @throws 空白のみ・上限超過。 */
export function messageBody(value: unknown): string {
  if (typeof value !== 'string' || !value.trim() || value.length > 2000) {
    throw new HTTPException(400, { message: '本文は1〜2,000文字で入力してください。' });
  }
  return value.trim();
}

/** @param value 入力値。 @returns 非負の整数。 @throws 不正な数値。 */
export function integer(value: unknown): number {
  const number = typeof value === 'string' && value !== '' ? Number(value) : value;
  if (typeof number !== 'number' || !Number.isSafeInteger(number) || number < 0) throw new HTTPException(400, { message: '番号が不正です。' });
  return number;
}
