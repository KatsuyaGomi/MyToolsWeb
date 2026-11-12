import { useCallback, useEffect, useRef, useState } from 'react';
import type { TodoBoard } from '../types';

/**
 * セッションCookieで個人のボードを取得する。
 * @param signal 取得中止用シグナル。
 * @returns 保存済みボード。
 * @throws 通信または認証に失敗した場合。
 */
async function loadBoard(signal?: AbortSignal): Promise<TodoBoard> {
  const response = await fetch('/api/todo', { signal, cache: 'no-store' });
  if (!response.ok) throw new Error('Todoを読み込めませんでした。再読み込みするか、ログインし直してください。');
  return response.json();
}

/**
 * ボードの取得、楽観的な保存、端末間の競合処理を管理する。
 * @returns ボードと読み込み・保存状態、再取得・保存操作。
 */
export function useTodoBoard() {
  const [board, setBoard] = useState<TodoBoard | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const locked = useRef(false);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(/** 最新データを取得し、画面を離れた場合は通信を中止する。 @returns 中止処理。 */ () => {
    const controller = new AbortController();
    /** 読み込み結果と失敗表示を更新する。 */
    async function load() {
      try {
        setError('');
        setBoard(await loadBoard(controller.signal));
      } catch (cause) {
        if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : '読み込みに失敗しました。');
      }
    }
    void load();
    return /** 取得中のリクエストを中止する。 */ () => controller.abort();
  }, [reloadKey]);

  const save = useCallback(/**
   * 保存中は二重操作を抑止し、失敗時は元に戻す。競合時は最新状態を取り直す。
   * @param next 次のボード。
   * @returns 保存できた場合はtrue。
   */ async (next: TodoBoard): Promise<boolean> => {
    if (locked.current || !board || next === board) return false;
    locked.current = true;
    setBusy(true);
    setError('');
    setBoard(next);
    try {
      const response = await fetch('/api/todo', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(next),
      });
      if (response.status === 409) {
        setBoard(await loadBoard());
        setError('別の端末で更新されました。最新の内容を確認して、もう一度操作してください。');
        return false;
      }
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || '保存に失敗しました。');
      setBoard(result);
      return true;
    } catch (cause) {
      setBoard(board);
      setError(cause instanceof Error ? cause.message : '保存に失敗しました。');
      return false;
    } finally {
      locked.current = false;
      setBusy(false);
    }
  }, [board]);

  /** 読み込みを再試行する。 */
  function reload() {
    setReloadKey(reloadKey + 1);
  }
  return { board, busy, error, save, reload };
}
