import { useEffect, useRef, useState } from 'react';
import type { GroupDirectory } from '../../../shared/groups';

/**
 * 管理画面のグループ設定を取得し、版番号付きの変更を送る。
 * @param userIds 表示中ユーザーのID。
 * @returns 設定、通信状態と保存操作。
 */
export function useGroupAdmin(userIds: string[]) {
  const userKey = userIds.join(',');
  const [data, setData] = useState<GroupDirectory | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [version, setVersion] = useState(0);
  const locked = useRef(false);

  useEffect(/** 設定を取得し、画面を離れた場合は中止する。 @returns 中止処理。 */ () => {
    const controller = new AbortController();
    /** 表示中のユーザーに必要な所属情報だけを取得する。 */
    async function load() {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        for (const id of userKey.split(',').filter(Boolean)) params.append('userId', id);
        const response = await fetch(`/api/admin/groups?${params}`, { signal: controller.signal, cache: 'no-store' });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || '設定を取得できませんでした。');
        if (!controller.signal.aborted) setData(result);
      } catch (cause) {
        if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : '通信に失敗しました。');
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }
    void load();
    return /** 取得を中止する。 */ () => controller.abort();
  }, [userKey, version]);

  /** 設定の版番号と所属を再読み込みする。 */
  function reload() {
    setError('');
    setVersion(/** @param current 現在の取得番号。 @returns 次の番号。 */ (current) => current + 1);
  }

  /**
   * 所属・グループの変更を保存する。競合時は下書きを維持し、再操作を案内する。
   * @param path 保存先。
   * @param method 変更方法。
   * @param body 入力。
   * @returns 保存できた場合はtrue。
   */
  async function save(path: string, method: 'POST' | 'PUT' | 'DELETE', body: Record<string, unknown>): Promise<boolean> {
    if (!data || locked.current || loading) return false;
    locked.current = true;
    setBusy(true);
    setError('');
    try {
      const response = await fetch(path, {
        method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...body, revision: data.revision }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || '保存できませんでした。');
      reload();
      return true;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '通信に失敗しました。');
      return false;
    } finally {
      locked.current = false;
      setBusy(false);
    }
  }
  return { data, error, busy: busy || loading, loading, reload, save };
}
