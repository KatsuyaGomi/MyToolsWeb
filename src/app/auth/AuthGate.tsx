import type { ReactNode } from 'react';
import { authClient } from './client';
import { AuthScreen } from './AuthScreen';

interface AuthGateProps {
  children: ReactNode;
}

/**
 * サーバーのセッションを確認し、ログイン済みの利用者にアプリを表示する。
 * @param props 認証後に表示する画面。
 * @returns ログイン画面、読み込み状態、またはアプリ本体。
 */
export function AuthGate({ children }: AuthGateProps) {
  const { data, isPending, error, refetch } = authClient.useSession();

  /** 認証サービスへの接続を再試行する。 */
  function retrySession() {
    void refetch();
  }

  if (isPending) {
    return <main className="grid min-h-dvh place-items-center text-sm text-muted" role="status">ログイン状態を確認しています…</main>;
  }
  if (error) {
    return (
      <main className="grid min-h-dvh place-items-center p-6">
        <div className="max-w-md rounded-lg border border-line bg-panel p-7">
          <h1 className="text-xl font-semibold">認証サービスに接続できません</h1>
          <p role="alert" className="mt-4 text-sm leading-7 text-muted">初回の設定が完了していないか、一時的に利用できません。時間をおいて再度お試しください。</p>
          <button type="button" onClick={retrySession} className="mt-6 rounded bg-accent px-4 py-2 text-sm font-semibold text-canvas">再試行</button>
        </div>
      </main>
    );
  }
  return data?.user ? children : <AuthScreen />;
}
