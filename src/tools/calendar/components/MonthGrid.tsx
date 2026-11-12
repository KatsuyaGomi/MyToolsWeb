import { occursOn, todayInJapan } from '../lib/dates';
import type { CalendarEvent } from '../types';

interface Props {
  days: string[];
  month: string;
  selectedDay: string;
  events: CalendarEvent[];
  onSelect: (day: string) => void;
}

/**
 * 月間カレンダーと予定の概要を表示する。選択日の詳細は別パネルに表示する。
 * @param props 表示月、日付、絞り込み済み予定と選択操作。
 * @returns 月間カレンダー。
 */
export function MonthGrid({ days, month, selectedDay, events, onSelect }: Props) {
  const today = todayInJapan();
  return (
    <div className="overflow-x-auto rounded-lg border border-line bg-panel">
      <div className="grid min-w-[280px] grid-cols-7" aria-label="月間カレンダー">
        {['日', '月', '火', '水', '木', '金', '土'].map(/** @param day 曜日。 @returns 曜日見出し。 */ (day) => (
          <div key={day} className="border-b border-line bg-elevated py-2 text-center text-xs text-muted">{day}</div>
        ))}
        {days.map(/** @param day 日付。 @returns 日付セル。 */ (day) => {
          const items = events.filter(/** @param event 予定。 @returns この日に重なるか。 */ (event) => occursOn(event, day));
          const selected = day === selectedDay;
          return (
            <button key={day} type="button" aria-label={`${day}、${items.length}件の予定`} aria-pressed={selected}
              onClick={/** 日付を選択する。 */ () => onSelect(day)}
              className={`flex min-h-16 min-w-0 flex-col items-stretch border-r border-b border-line p-1 text-left transition hover:bg-elevated md:min-h-28 md:p-2 ${selected ? 'bg-selection ring-1 ring-inset ring-accent' : ''} ${day.startsWith(month) ? '' : 'text-muted'}`}>
              <span className={`mb-1 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs ${day === today ? 'bg-accent font-bold text-canvas' : ''}`}>{Number(day.slice(8))}</span>
              {items.length > 0 && <span className="text-[10px] text-accent md:hidden">{items.length}件</span>}
              <span className="hidden flex-col gap-1 md:flex">
                {items.slice(0, 2).map(/** @param event 予定。 @returns 公開範囲と登録者を示す概要。 */ (event) => (
                  <span key={event.id} className={`block rounded border-l-2 px-1 py-1 text-[10px] leading-4 md:text-xs ${event.visibility === 'public' ? 'border-accent bg-accent/10' : 'border-purple-300 bg-purple-300/10'}`}>
                    <span className="block truncate">{event.startAt.slice(0, 10) === day ? event.startAt.slice(11) : '継続'} {event.title}</span>
                    <span className="block truncate text-muted">{event.visibility === 'public' ? 'Public' : 'Private'} · {event.ownerName}</span>
                  </span>
                ))}
                {items.length > 2 && <span className="text-[10px] text-muted md:text-xs">ほか{items.length - 2}件</span>}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
