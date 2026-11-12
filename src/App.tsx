import { AppLayout } from './app/layouts/AppLayout';
import { AppRoutes } from './app/router/AppRoutes';

/**
 * アプリ共通のレイアウトと現在のURLに対応するページを描画する。
 * @returns 共通枠に収めたページ。
 */
export function App() {
  return (
    <AppLayout>
      <AppRoutes />
    </AppLayout>
  );
}
