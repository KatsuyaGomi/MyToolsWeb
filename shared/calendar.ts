export type CalendarVisibility = 'private' | 'public';
export type CalendarScope = 'public' | 'mine';

export interface CalendarInput {
  title: string;
  description: string;
  startAt: string;
  endAt: string;
  visibility: CalendarVisibility;
}

export interface CalendarEvent extends CalendarInput {
  id: string;
  revision: number;
  ownerName: string;
  isOwner: boolean;
}

/**
 * 日本時間の壁時計として扱う日時を検証する。端末のタイムゾーンに依存させない。
 * @param value YYYY-MM-DDTHH:mm形式の日時。
 * @returns 実在する日時で、分が5の倍数ならtrue。
 */
export function isCalendarTime(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) return false;
  const date = new Date(`${value}:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 16) === value && date.getUTCMinutes() % 5 === 0;
}
