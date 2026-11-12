import { formatEventTime, occursOn } from '../lib/dates';
import type { CalendarEvent } from '../types';

/**
 * 選択日の予定と、登録者・公開範囲を一覧にする。
 * @param props 日付、閲覧可能な予定と詳細を開く操作。
 * @returns 予定一覧。
 */
export function DayAgenda({ day, events, onOpen }: {
  day: string; events: CalendarEvent[]; onOpen: (event: CalendarEvent) => void;
}) {
  const items = events.filter(/** @param event 候補の予定。 @returns 選択日に重なるか。 */ (event) => occursOn(event, day));
  return (
    <section className="rounded-lg border border-line bg-panel p-4">
      <h2 className="mb-4 text-base font-semibold">{day.replaceAll('-', '/')} の予定 <span className="text-sm text-muted">({items.length})</span></h2>
      <div className="space-y-3">
        {items.map(/** @param event 表示予定。 @returns 詳細ボタン付きのカード。 */ (event) => (
          <button key={event.id} type="button" onClick={/** 詳細を開く。 */ () => onOpen(event)}
            className="block w-full rounded-lg border border-line bg-elevated p-3 text-left hover:border-accent">
            <span className="mb-2 block text-xs text-accent">{formatEventTime(event.startAt)} 〜 {formatEventTime(event.endAt)}</span>
            <span className="block break-words text-sm font-semibold">{event.title}</span>
            <span className="mt-2 flex flex-wrap items-center gap-2 text-xs">
              <span className={`rounded px-2 py-0.5 ${event.visibility === 'public' ? 'bg-accent/15 text-accent' : 'bg-purple-300/15 text-purple-200'}`}>{event.visibility === 'public' ? 'Public' : 'Private'}</span>
              <span className="break-all text-muted">登録者: {event.ownerName}{event.isOwner ? '（自分）' : ''}</span>
            </span>
          </button>
        ))}
        {items.length === 0 && <p className="py-8 text-center text-sm leading-6 text-muted">この日の予定はありません。<br />「予定追加」から登録できます。</p>}
      </div>
    </section>
  );
}
