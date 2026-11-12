import { useEffect, useRef, useState } from 'react';
import type { CalendarEvent, CalendarInput, CalendarScope } from '../types';

/**
 * 表示範囲ごとの予定取得と、本人の予定の保存を管理する。
 * @param from 取得開始日時。
 * @param to 取得終了日時（含まない）。
 * @param scope Publicを含むか本人のみか。
 * @returns 予定・状態と保存操作。
 */
export function useCalendar(from: string, to: string, scope: CalendarScope) {
  const key = `${from}/${to}/${scope}`;
  const [data, setData] = useState<{ key: string; events: CalendarEvent[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [version, setVersion] = useState(0);
  const locked = useRef(false);

  useEffect(/** 表示条件が変わったら取得し、前のリクエストを中止する。 @returns 中止処理。 */ () => {
    const controller = new AbortController();
    /** サーバー側で公開範囲を絞り込んだ予定を取得する。 */
    async function load() {
      setLoading(true);
      setLoadError('');
      try {
        const params = new URLSearchParams({ from, to, scope });
        const response = await fetch(`/api/calendar?${params}`, { signal: controller.signal, cache: 'no-store' });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || '予定を読み込めませんでした。');
        if (!controller.signal.aborted) setData({ key, events: result.events });
      } catch (cause) {
        if (!controller.signal.aborted) setLoadError(cause instanceof Error ? cause.message : '通信に失敗しました。');
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }
    void load();
    return /** 前の条件の取得を中止する。 */ () => controller.abort();
  }, [from, to, scope, key, version]);

  /** 最新の予定を読み直す。 */
  function reload() {
    setData(null);
    setVersion(/** @param current 現在の番号。 @returns 次の番号。 */ (current) => current + 1);
  }

  /**
   * 新規作成・編集・削除を保存し、成功した場合だけ再取得する。
   * @param input 新規・編集の入力。nullは削除。
   * @param event 編集・削除対象。未指定なら新規作成。
   * @returns 保存が確定した場合はtrue。
   */
  async function save(input: CalendarInput | null, event?: CalendarEvent): Promise<boolean> {
    if (locked.current) return false;
    locked.current = true;
    setBusy(true);
    setError('');
    try {
      const body = { ...input, ...(event ? { id: event.id, revision: event.revision } : {}) };
      const response = await fetch('/api/calendar', {
        method: !input ? 'DELETE' : event ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || '保存に失敗しました。');
      reload();
      return true;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '通信に失敗しました。');
      return false;
    } finally {
      setBusy(false);
      locked.current = false;
    }
  }

  /** ダイアログを開く際に直前の保存エラーを消す。 */
  function clearError() {
    setError('');
  }
  const events = data?.key === key ? data.events : [];
  return { events, loading: loading || (!data && !loadError), loadError, error, busy, save, reload, clearError };
}
