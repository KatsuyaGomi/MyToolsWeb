import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';

interface ManagedUser { id: string; name: string; email: string; role: string }

/** アプリ所有者が一般ユーザーを作成し、登録済みユーザーを確認する。 */
export function AdminUsersPage() {
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [allowed, setAllowed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  /** 初回表示時に管理者専用のユーザー一覧を読み込む。 */
  useEffect(function loadUsers() {
    const controller = new AbortController();
    /** 認可エラーと通信失敗を区別し、終了済み画面には反映しない。 */
    async function load() {
      try {
        const response = await fetch('/api/admin/users', { signal: controller.signal });
        if (!response.ok) throw new Error(response.status === 403 ? '管理者のみ利用できます。' : '一覧を取得できませんでした。');
        const data = await response.json() as { users: ManagedUser[] };
        if (!controller.signal.aborted) { setUsers(data.users); setAllowed(true); }
      } catch (cause) {
        if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : '通信に失敗しました。');
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }
    void load();
    /** ページ移動後の通信を中断する。 */
    return function cancelLoad() { controller.abort(); };
  }, []);

  /**
   * 入力内容を管理者APIへ送信し、一般ユーザーだけを作成する。
   * @param event アカウント作成フォームの送信イベント。
   */
  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const response = await fetch('/api/admin/users', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: form.get('name'), email: form.get('email'), password: form.get('password') }),
      });
      const data = await response.json() as { user: ManagedUser; error?: string };
      if (!response.ok) throw new Error(data.error ?? '作成できませんでした。');
      setUsers([data.user, ...users]);
      formElement.reset();
      setMessage('アカウントを作成しました。設定したメールアドレスとパスワードを本人に案内してください。');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '通信に失敗しました。');
    } finally {
      setBusy(false);
    }
  }

  /**
   * パスワード等の認証情報を含まないユーザー行を描画する。
   * @param user 一覧用のユーザー情報。
   * @returns ユーザーの表示名、メール、権限の行。
   */
  function renderUser(user: ManagedUser) {
    return (
      <tr key={user.id} className="border-t border-line">
        <td className="px-4 py-3">{user.name}</td>
        <td className="break-all px-4 py-3 text-muted">{user.email}</td>
        <td className="px-4 py-3">{user.role === 'admin' ? '管理者' : '一般'}</td>
      </tr>
    );
  }

  return (
    <section className="mx-auto max-w-5xl px-5 py-8 sm:px-8">
      <p className="text-xs font-semibold tracking-widest text-accent">ADMINISTRATION</p>
      <h1 className="mt-3 text-2xl font-semibold">アカウント管理</h1>
      <p className="mt-3 text-sm leading-7 text-muted">管理者が許可する利用者のアカウントを作成します。</p>
      {loading && <p role="status" className="mt-6 text-muted">読み込み中…</p>}
      {error && <p role="alert" className="mt-5 text-sm text-danger">{error}</p>}
      {message && <p role="status" className="mt-5 text-sm text-accent">{message}</p>}
      {allowed && (
        <>
          <form onSubmit={handleCreate} className="mt-7 space-y-5 rounded-lg border border-line bg-panel p-6">
            <h2 className="font-semibold">アカウントを作成</h2>
            <label className="block text-sm">表示名
              <input name="name" required maxLength={60} disabled={busy} autoComplete="off" className="mt-2 w-full rounded border border-line bg-canvas px-3 py-2.5" />
            </label>
            <label className="block text-sm">メールアドレス
              <input name="email" type="email" required maxLength={254} disabled={busy} autoComplete="off" className="mt-2 w-full rounded border border-line bg-canvas px-3 py-2.5" />
            </label>
            <label className="block text-sm">初期パスワード（12文字以上）
              <input name="password" type="password" required minLength={12} maxLength={128} disabled={busy} autoComplete="new-password" className="mt-2 w-full rounded border border-line bg-canvas px-3 py-2.5" />
            </label>
            <button type="submit" disabled={busy} className="rounded bg-accent px-5 py-2.5 text-sm font-semibold text-canvas disabled:opacity-50">{busy ? '作成中…' : 'アカウントを作成'}</button>
          </form>
          <h2 className="mb-4 mt-8 font-semibold">登録済みユーザー（最新100件）</h2>
          <div className="overflow-x-auto rounded-lg border border-line bg-panel">
            <table className="w-full text-left text-sm">
              <thead className="bg-elevated text-xs text-muted"><tr><th className="px-4 py-3">表示名</th><th className="px-4 py-3">メールアドレス</th><th className="px-4 py-3">権限</th></tr></thead>
              <tbody>{users.map(renderUser)}</tbody>
            </table>
          </div>
        </>
      )}
    </section>
  );
}
