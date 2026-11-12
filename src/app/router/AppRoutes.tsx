import { HomePage } from '../pages/HomePage';

/**
 * 現在のパスに対応するページを選び、未定義のURLは案内画面にする。
 * @returns ホームまたは見つからないページの案内。
 */
export function AppRoutes() {
  if (window.location.pathname === '/') {
    return <HomePage />;
  }

  return (
    <section className="mx-auto max-w-3xl px-6 py-20">
      <p className="mb-4 text-sm font-semibold text-accent">404 / ページが見つかりません</p>
      <h1 className="text-2xl font-semibold">このページはまだありません</h1>
      <p className="mt-4 text-sm leading-7 text-muted">URLを確認するか、ホームからツールを選択してください。</p>
      <a href="/" className="mt-8 inline-block rounded bg-accent px-4 py-2 text-sm font-semibold text-canvas hover:brightness-110">
        ホームへ戻る
      </a>
    </section>
  );
}
