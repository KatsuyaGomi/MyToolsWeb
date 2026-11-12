import { AppLayout } from './app/layouts/AppLayout';
import { AppRoutes } from './app/router/AppRoutes';
import { AuthGate } from './app/auth/AuthGate';
import { SetupPage } from './app/auth/SetupPage';

/**
 * アプリ共通のレイアウトと現在のURLに対応するページを描画する。
 * @returns 共通枠に収めたページ。
 */
export function App() {
  if (window.location.pathname === '/setup') return <SetupPage />;
  return (
    <AuthGate>
      <AppLayout>
        <AppRoutes />
      </AppLayout>
    </AuthGate>
  );
}
