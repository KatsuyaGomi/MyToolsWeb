import { useState } from 'react';
import type { FormEvent } from 'react';
import { authClient } from './client';
import { Icon } from '../../shared/components/Icon';

/**
 * メールアドレスとパスワードによるログイン・新規登録フォームを表示する。
 * @returns ログイン前の画面。
 */
export function AuthScreen() {
  const [isSignUp, setIsSignUp] = useState(false);
  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState('');

  /** フォームの種類を切り替えて直前のエラーを消去する。 */
  function toggleMode() {
    setIsSignUp(!isSignUp);
    setError('');
  }

  /**
   * 入力を認証APIへ送信する。パスワードを独自に保存しない。
   * @param event フォームの送信イベント。
   */
  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const email = String(form.get('email') ?? '').trim();
    const password = String(form.get('password') ?? '');
    const name = String(form.get('name') ?? '').trim();
    setIsBusy(true);
    setError('');
    try {
      const result = isSignUp
        ? await authClient.signUp.email({ email, password, name })
        : await authClient.signIn.email({ email, password, rememberMe: false });
      if (result.error) {
        const isUnavailable = result.error.status >= 500;
        setError(isUnavailable ? '認証の初期設定が完了していないか、一時的に利用できません。' : '入力内容を確認してください。登録済みのメールではログインをお試しください。');
      }
    } catch {
      setError('接続できませんでした。しばらく待ってから再度お試しください。');
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
        <h1 id="auth-heading" className="text-2xl font-semibold">{isSignUp ? 'アカウントを作成' : 'おかえりなさい'}</h1>
        <p className="mt-3 text-sm leading-7 text-muted">{isSignUp ? '自分のメールアドレスで登録して、道具箱を使い始めましょう。' : 'ログインして、自分のワークスペースを開きましょう。'}</p>
        <form onSubmit={handleSubmit} className="mt-7 space-y-5">
          {isSignUp && (
            <label className="block text-sm">
              表示名
              <input name="name" autoComplete="nickname" required maxLength={60} disabled={isBusy}
                className="mt-2 w-full rounded border border-line bg-canvas px-3 py-2.5" />
            </label>
          )}
          <label className="block text-sm">
            メールアドレス
            <input name="email" type="email" autoComplete="email" required maxLength={254} disabled={isBusy}
              className="mt-2 w-full rounded border border-line bg-canvas px-3 py-2.5" />
          </label>
          <label className="block text-sm">
            パスワード
            <input key={isSignUp ? 'new' : 'current'} name="password" type="password"
              autoComplete={isSignUp ? 'new-password' : 'current-password'} required minLength={12} maxLength={128} disabled={isBusy}
              className="mt-2 w-full rounded border border-line bg-canvas px-3 py-2.5" />
            {isSignUp && <span className="mt-2 block text-xs text-muted">12文字以上で設定してください。</span>}
          </label>
          {error && <p role="alert" className="text-sm leading-6 text-danger">{error}</p>}
          <button type="submit" disabled={isBusy} className="w-full rounded bg-accent px-4 py-3 text-sm font-semibold text-canvas hover:brightness-110 disabled:cursor-wait disabled:opacity-50">
            {isBusy ? '処理中…' : isSignUp ? '登録してはじめる' : 'ログイン'}
          </button>
        </form>
        <button type="button" onClick={toggleMode} disabled={isBusy} className="mt-6 w-full text-sm text-accent hover:underline disabled:opacity-50">
          {isSignUp ? 'アカウントをお持ちの方はログイン' : 'はじめての方はアカウントを作成'}
        </button>
        <p className="mt-7 border-t border-line pt-5 text-xs leading-6 text-muted">
          自動のパスワード再設定メールは未対応です。パスワードを忘れた場合は管理者へご連絡ください。
        </p>
      </section>
    </main>
  );
}
