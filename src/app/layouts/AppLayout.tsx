import { useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { Icon } from '../../shared/components/Icon';
import { SidebarNav } from './SidebarNav';

interface AppLayoutProps {
  children: ReactNode;
}

/**
 * ヘッダー、共通サイドメニュー、作業エリアを配置する。
 * @param props 現在のページの内容。
 * @returns デスクトップとモバイルに対応した共通レイアウト。
 */
export function AppLayout({ children }: AppLayoutProps) {
  const menuRef = useRef<HTMLDialogElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  /** モーダルメニューを開き、ブラウザー標準のフォーカス制御を開始する。 */
  function openMenu() {
    menuRef.current?.showModal();
    setIsMenuOpen(true);
  }

  /** メニューを閉じる。Escapeによる終了もdialogのcloseイベントで処理する。 */
  function closeMenu() {
    menuRef.current?.close();
  }

  /** メニューの終了を状態に反映し、開閉ボタンへフォーカスを戻す。 */
  function handleMenuClosed() {
    setIsMenuOpen(false);
    menuButtonRef.current?.focus();
  }

  return (
    <div className="min-h-dvh">
      <a href="#main-content" className="sr-only fixed left-4 top-3 z-50 rounded bg-accent p-3 text-canvas focus:not-sr-only">
        本文へスキップ
      </a>
      <header className="fixed inset-x-0 top-0 z-20 flex h-14 items-center justify-between border-b border-line bg-panel px-4 md:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <button ref={menuButtonRef} type="button" onClick={openMenu}
            aria-label="メニューを開く" aria-controls="mobile-menu" aria-expanded={isMenuOpen}
            className="rounded p-2 text-muted hover:bg-elevated md:hidden">
            <Icon name="menu" />
          </button>
          <a href="/" className="flex items-center gap-2.5 font-semibold tracking-tight" aria-label="My Tools ホーム">
            <span className="rounded bg-selection p-1.5 text-accent">
              <Icon name="grid" className="size-4" />
            </span>
            My Tools
          </a>
          <span className="mx-2 hidden h-5 border-l border-line sm:block" />
          <span className="hidden text-xs text-muted sm:block">パーソナル ワークスペース</span>
        </div>
        <span className="grid size-7 place-items-center rounded-full border border-line bg-elevated text-[10px] font-semibold text-accent"
          aria-label="My Tools ワークスペース">MT</span>
      </header>

      <aside className="fixed bottom-0 left-0 top-14 hidden w-60 flex-col border-r border-line bg-panel md:flex">
        <SidebarNav />
        <div className="border-t border-line px-6 py-4 text-[11px] text-muted">
          MY TOOLS <span className="ml-2 text-ink/60">/ 自分のための道具箱</span>
        </div>
      </aside>

      <dialog ref={menuRef} id="mobile-menu" aria-label="ツールメニュー" onClose={handleMenuClosed}
        className="fixed inset-y-0 left-0 m-0 h-dvh max-h-none w-72 max-w-[85vw] border-r border-line bg-panel p-0 text-ink backdrop:bg-black/65">
        <div className="flex h-full flex-col">
          <div className="flex items-center justify-between border-b border-line px-6 py-3">
            <span className="font-semibold">My Tools</span>
            <button type="button" onClick={closeMenu} aria-label="メニューを閉じる" className="rounded p-2 hover:bg-elevated">
              <Icon name="close" />
            </button>
          </div>
          <SidebarNav onNavigate={closeMenu} />
        </div>
      </dialog>

      <main id="main-content" tabIndex={-1} className="min-h-dvh min-w-0 pt-14 md:ml-60">
        {children}
      </main>
    </div>
  );
}
