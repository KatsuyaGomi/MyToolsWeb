import { isCalendarTime } from '../../../shared/calendar.ts';
import type { CalendarInput, CalendarScope } from '../../../shared/calendar.ts';

/**
 * 予定の必須項目・公開範囲・5分刻み・日時の前後関係を検証する。
 * @param value 未検証のJSON。
 * @returns 許可された項目のみの入力。不正ならnull。
 */
export function parseEvent(value: unknown): CalendarInput | null {
  if (typeof value !== 'object' || value === null) return null;
  const input = value as Record<string, unknown>;
  if (typeof input.title !== 'string' || !input.title.trim() || input.title.length > 200) return null;
  if (typeof input.description !== 'string' || input.description.length > 4000) return null;
  if (!isCalendarTime(input.startAt) || !isCalendarTime(input.endAt) || input.endAt <= input.startAt) return null;
  if (input.visibility !== 'private' && input.visibility !== 'public') return null;
  return {
    title: input.title.trim(), description: input.description,
    startAt: input.startAt, endAt: input.endAt, visibility: input.visibility,
  };
}

/**
 * 一覧取得の対象期間と表示範囲を検証する。
 * @param url クエリー付きURL。
 * @returns 検証済み条件。不正ならnull。
 */
export function parseRange(url: URL): { from: string; to: string; scope: CalendarScope } | null {
  const from = url.searchParams.get('from');
  const to = url.searchParams.get('to');
  const scope = url.searchParams.get('scope') ?? 'public';
  if (!isCalendarTime(from) || !isCalendarTime(to) || from >= to) return null;
  const duration = Date.parse(`${to}Z`) - Date.parse(`${from}Z`);
  if (duration > 62 * 86_400_000 || (scope !== 'public' && scope !== 'mine')) return null;
  return { from, to, scope };
}
