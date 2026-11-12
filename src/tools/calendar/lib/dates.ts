/** @returns 日本時間での今日の日付（YYYY-MM-DD）。 */
export function todayInJapan(): string {
  return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Tokyo' }).format(new Date());
}

/**
 * 日付を指定日数だけ進める。壁時計の日付を端末の時差から独立させる。
 * @param day YYYY-MM-DD形式の日付。
 * @param count 加算する日数。
 * @returns 加算後の日付。
 */
export function addDays(day: string, count: number): string {
  const date = new Date(`${day}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + count);
  return date.toISOString().slice(0, 10);
}

/** @param month YYYY-MM形式の月。 @param count 移動月数。 @returns 移動先の月初の日付。 */
export function shiftMonth(month: string, count: number): string {
  const date = new Date(`${month}-01T00:00:00Z`);
  date.setUTCMonth(date.getUTCMonth() + count);
  return date.toISOString().slice(0, 10);
}

/** @param month 表示月。 @returns 日曜始まり6週分の日付。 */
export function monthDays(month: string): string[] {
  const first = `${month}-01`;
  const offset = new Date(`${first}T00:00:00Z`).getUTCDay();
  const start = addDays(first, -offset);
  const days: string[] = [];
  for (let index = 0; index < 42; index++) days.push(addDays(start, index));
  return days;
}

/**
 * 終了日時を含まない区間として、その日に予定が重なるか調べる。
 * @param event 予定の日時。
 * @param day 対象日。
 * @returns その日に表示する場合はtrue。
 */
export function occursOn(event: { startAt: string; endAt: string }, day: string): boolean {
  return event.startAt < `${addDays(day, 1)}T00:00` && event.endAt > `${day}T00:00`;
}

/** @param value 予定の日時。 @returns 日本語の日付と時刻。 */
export function formatEventTime(value: string): string {
  return `${value.slice(5, 7)}/${value.slice(8, 10)} ${value.slice(11)}`;
}
