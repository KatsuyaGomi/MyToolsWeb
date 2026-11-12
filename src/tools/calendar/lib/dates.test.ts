/// <reference types="node" />
import assert from 'node:assert/strict';
import test from 'node:test';
import { addDays, monthDays, occursOn, shiftMonth } from './dates.ts';

/** 月境界・うるう日・日をまたぐ予定と終了時刻を含めない判定を検証する。 */
function handlesCalendarBoundaries() {
  const days = monthDays('2026-11');
  assert.equal(days.length, 42);
  assert.equal(days[0], '2026-11-01');
  assert.equal(days[41], '2026-12-12');
  assert.equal(addDays('2028-02-28', 1), '2028-02-29');
  assert.equal(shiftMonth('2026-12', 1), '2027-01-01');
  const overnight = { startAt: '2026-11-12T23:55', endAt: '2026-11-13T00:05' };
  assert.equal(occursOn(overnight, '2026-11-12'), true);
  assert.equal(occursOn(overnight, '2026-11-13'), true);
  assert.equal(occursOn({ ...overnight, endAt: '2026-11-13T00:00' }, '2026-11-13'), false);
  assert.equal(occursOn(overnight, '2026-11-14'), false);
}

test('カレンダーの日付・月境界と日をまたぐ予定を扱う', handlesCalendarBoundaries);
