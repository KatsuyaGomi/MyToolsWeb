import { useState } from 'react';
import type { FormEvent } from 'react';
import { authClient } from './client';
import { Icon } from '../../shared/components/Icon';

/** ログイン専用フォームを描画する。アカウントは管理者が作成する。 */
export function AuthScreen() {
  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState('');

  /**
   * 入力されたアカウントでログインする。パスワードを独自に保存しない。
   * @param event フォームの送信イベント。
   */
  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setIsBusy(true);
    setError('');
    try {
      const result = await authClient.signIn.email({
        email: String(form.get('email') ?? '').trim(),
        password: String(form.get('password') ?? ''),
        rememberMe: false,
      });
      if (result.error) {
        setError(result.error.status >= 500
          ? '一時的にログインできません。しばらく待ってからお試しください。'
          : 'メールアドレスまたはパスワードを確認してください。');
      }
    } catch {
      setError('接続できませんでした。しばらく待ってからお試しください。');
    } finally {
      setIsBusy(false);
    }
  }

  return (
    <main className="grid min-h-dvh place-items-center px-5 py-12">
      <section className="w-full max-w-md rounded-xl border border-line bg-panel p-7 sm:p-9" aria-labelledby="auth-heading">
        <a href="/" className="mb-9 flex items-center gap-3 font-semibold">
          <span className="rounded-lg bg-selection p-2 text-accent"><Icon name="grid" /></span>
          My Tools
        </a>
        <p className="mb-3 text-[10px] font-semibold tracking-[.18em] text-accent">PERSONAL WORKSPACE</p>
        <h1 id="auth-heading" className="text-2xl font-semibold">おかえりなさい</h1>
        <p className="mt-3 text-sm leading-7 text-muted">管理者から案内されたアカウントでログインしてください。</p>
        <form onSubmit={handleSubmit} className="mt-7 space-y-5">
          <label className="block text-sm">
            メールアドレス
            <input name="email" type="email" autoComplete="email" required maxLength={254} disabled={isBusy}
              className="mt-2 w-full rounded border border-line bg-canvas px-3 py-2.5" />
          </label>
          <label className="block text-sm">
            パスワード
            <input name="password" type="password" autoComplete="current-password" required minLength={12} maxLength={128} disabled={isBusy}
              className="mt-2 w-full rounded border border-line bg-canvas px-3 py-2.5" />
          </label>
          {error && <p role="alert" className="text-sm leading-6 text-danger">{error}</p>}
          <button type="submit" disabled={isBusy} className="w-full rounded bg-accent px-4 py-3 text-sm font-semibold text-canvas hover:brightness-110 disabled:opacity-50">
            {isBusy ? '処理中…' : 'ログイン'}
          </button>
        </form>
        <p className="mt-7 border-t border-line pt-5 text-xs leading-6 text-muted">
          アカウントの作成・パスワードの再設定は管理者にご相談ください。
        </p>
      </section>
    </main>
  );
}
