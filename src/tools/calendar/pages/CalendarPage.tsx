import { useState } from 'react';
import { primaryStyle, secondaryStyle, fieldStyle } from '../../../shared/components/Modal';
import { useCalendar } from '../hooks/useCalendar';
import { addDays, monthDays, shiftMonth, todayInJapan } from '../lib/dates';
import { MonthGrid } from '../components/MonthGrid';
import { DayAgenda } from '../components/DayAgenda';
import { EventDialog } from '../components/EventDialog';
import type { CalendarEvent, CalendarScope } from '../types';

/**
 * Public予定と自分の予定を切り替えられる月間カレンダー。
 * @returns カレンダーページ。
 */
export function CalendarPage() {
  const [day, setDay] = useState(todayInJapan);
  const [month, setMonth] = useState(day.slice(0, 7));
  const [scope, setScope] = useState<CalendarScope>('public');
  const [editing, setEditing] = useState<{ event?: CalendarEvent } | null>(null);
  const days = monthDays(month);
  const calendar = useCalendar(`${days[0]}T00:00`, `${addDays(days[41], 1)}T00:00`, scope);

  /** @param count 移動する月数。月初を選択して表示月を変更する。 */
  function navigate(count: number) {
    const next = shiftMonth(month, count);
    setMonth(next.slice(0, 7));
    setDay(next);
  }

  /** 今日の月と日付に戻る。 */
  function today() {
    const current = todayInJapan();
    setMonth(current.slice(0, 7));
    setDay(current);
  }

  /** @param event 閲覧・編集する予定。未指定なら選択日に新規追加。 */
  function open(event?: CalendarEvent) {
    calendar.clearError();
    setEditing({ event });
  }

  return (
    <section className="p-4 md:p-8">
      <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="mb-2 text-xs font-semibold tracking-widest text-accent">MY WORKSPACE / CALENDAR</p>
          <h1 className="text-2xl font-semibold">カレンダー</h1>
          <p className="mt-2 text-sm leading-6 text-muted">自分の予定と、同じグループのPublic予定。日時は日本時間・5分単位です。</p>
        </div>
        <button type="button" disabled={calendar.busy} onClick={/** 選択日に追加する。 */ () => open()} className={primaryStyle}>＋ 予定追加</button>
      </header>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button type="button" aria-label="前の月" onClick={/** 前月へ移動する。 */ () => navigate(-1)} className={secondaryStyle}>‹</button>
          <h2 className="min-w-28 text-center text-lg font-semibold">{month.replace('-', '年')}月</h2>
          <button type="button" aria-label="次の月" onClick={/** 翌月へ移動する。 */ () => navigate(1)} className={secondaryStyle}>›</button>
          <button type="button" onClick={today} className={secondaryStyle}>今日</button>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <label className="text-xs text-muted">表示する予定
            <select value={scope} className={fieldStyle}
              onChange={/** 閲覧範囲を切り替える。 @param action 選択変更。 */ (action) => setScope(action.target.value as CalendarScope)}>
              <option value="public">Public — 自分＋共通グループの公開予定</option>
              <option value="mine">自分の予定のみ</option>
            </select>
          </label>
          <button type="button" disabled={calendar.loading} onClick={calendar.reload} className={secondaryStyle}>再読み込み</button>
        </div>
      </div>
      <p role="status" aria-live="polite" className="mb-4 text-xs text-muted">{calendar.loading ? '予定を読み込み中…' : `表示期間内 ${calendar.events.length}件 · Publicは共通グループのメンバーに公開`}</p>
      {!calendar.loading && !calendar.loadError && <p className="mb-4 text-xs text-muted">
        所属グループ: {calendar.groups.map(/** @param group 所属先。 @returns 名前。 */ (group) => group.name).join('、') || '未所属（他人のPublic予定は表示されません）'}
      </p>}
      {calendar.loadError && <p role="alert" className="mb-4 rounded border border-danger/40 p-3 text-sm text-danger">{calendar.loadError}</p>}
      <p className="mb-3 text-xs text-muted">日付を選択すると、その日の予定と登録者を一覧で確認できます。</p>
      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
        <MonthGrid days={days} month={month} selectedDay={day} events={calendar.events} onSelect={setDay} />
        <DayAgenda day={day} events={calendar.events} onOpen={open} />
      </div>
      {editing && <EventDialog day={day} event={editing.event} busy={calendar.busy} error={calendar.error} groups={calendar.groups}
        save={calendar.save} onClose={/** 詳細を閉じる。 */ () => setEditing(null)} />}
    </section>
  );
}
