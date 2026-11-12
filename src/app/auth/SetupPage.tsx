import { useState } from 'react';
import type { FormEvent } from 'react';

/** 一度限りのリンクで管理者本人が初期パスワードを設定する。 */
export function SetupPage() {
  const [token] = useState(readSetupToken);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [complete, setComplete] = useState(false);

  /**
   * 初期設定トークンをURLフラグメントから取得する。通常のHTTPリクエストには送らない。
   * @returns 初期設定リンクのトークン。
   */
  function readSetupToken() { return new URLSearchParams(window.location.hash.slice(1)).get('token') ?? ''; }

  /**
   * 入力された管理者情報を初期設定APIへ送る。
   * @param event 初期設定フォームの送信イベント。
   */
  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    if (form.get('password') !== form.get('confirm')) { setMessage('パスワードが一致しません。'); return; }
    setBusy(true);
    setMessage('');
    try {
      const response = await fetch('/api/setup', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, name: form.get('name'), email: form.get('email'), password: form.get('password') }),
      });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error ?? '設定に失敗しました。');
      setComplete(true);
      window.history.replaceState(null, '', '/setup');
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : '接続できませんでした。');
    } finally { setBusy(false); }
  }

  return (
    <main className="grid min-h-dvh place-items-center px-5 py-10">
      <section className="w-full max-w-md rounded-xl border border-line bg-panel p-7">
        <p className="text-xs font-semibold tracking-widest text-accent">MY TOOLS / INITIAL SETUP</p>
        <h1 className="mt-4 text-2xl font-semibold">管理者の初期設定</h1>
        {complete ? (
          <div className="mt-6 text-sm leading-7">
            <p role="status">管理者アカウントを作成しました。設定したパスワードでログインしてください。</p>
            <a href="/" className="mt-5 inline-block rounded bg-accent px-4 py-2 font-semibold text-canvas">ログイン画面へ</a>
          </div>
        ) : !token ? (
          <p role="alert" className="mt-6 text-sm text-muted">管理者用の初期設定リンクから開いてください。</p>
        ) : (
          <form onSubmit={handleSubmit} className="mt-6 space-y-5">
            <p className="text-sm leading-7 text-muted">指定した管理者メールを入力し、ご自身のパスワードを設定してください。</p>
            <label className="block text-sm">表示名<input name="name" required maxLength={60} autoComplete="nickname" disabled={busy} className="mt-2 w-full rounded border border-line bg-canvas p-3" /></label>
            <label className="block text-sm">管理者メール<input name="email" type="email" required maxLength={254} autoComplete="email" disabled={busy} className="mt-2 w-full rounded border border-line bg-canvas p-3" /></label>
            <label className="block text-sm">パスワード（12文字以上）<input name="password" type="password" required minLength={12} maxLength={128} autoComplete="new-password" disabled={busy} className="mt-2 w-full rounded border border-line bg-canvas p-3" /></label>
            <label className="block text-sm">パスワード（確認）<input name="confirm" type="password" required minLength={12} maxLength={128} autoComplete="new-password" disabled={busy} className="mt-2 w-full rounded border border-line bg-canvas p-3" /></label>
            {message && <p role="alert" className="text-sm leading-6 text-danger">{message}</p>}
            <button type="submit" disabled={busy} className="w-full rounded bg-accent px-4 py-3 text-sm font-semibold text-canvas disabled:opacity-50">{busy ? '設定中…' : '管理者アカウントを作成'}</button>
          </form>
        )}
      </section>
    </main>
  );
}
