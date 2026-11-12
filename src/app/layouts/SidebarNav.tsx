import { Icon } from '../../shared/components/Icon';
import { tools } from '../../tools/registry';
import type { ToolDefinition } from '../../tools/registry';

interface SidebarNavProps {
  onNavigate?: () => void;
}

/**
 * ホームと実装済みツールへの共通メニューを描画する。
 * @param props モバイルでリンクを選択した際の終了処理。
 * @returns カテゴリー別のナビゲーション。
 */
export function SidebarNav({ onNavigate }: SidebarNavProps) {
  const pathname = window.location.pathname;
  const categories = [...new Set(tools.map(getCategory))];

  /**
   * ツールの分類名を取得する。
   * @param tool 登録済みツール。
   * @returns 分類名。
   */
  function getCategory(tool: ToolDefinition) {
    return tool.category;
  }

  /**
   * ひとつのカテゴリーと所属ツールを描画する。
   * @param category 分類名。
   * @returns カテゴリー見出しとリンクの一覧。
   */
  function renderCategory(category: string) {
    /**
     * ツールが現在のカテゴリーに所属するかを判定する。
     * @param tool 判定対象のツール。
     * @returns カテゴリーが一致する場合に真。
     */
    function belongsToCategory(tool: ToolDefinition) {
      return tool.category === category;
    }

    return (
      <div key={category} className="mt-6">
        <p className="mb-2 px-3 text-xs font-medium text-muted">{category}</p>
        {tools.filter(belongsToCategory).map(renderToolLink)}
      </div>
    );
  }

  /**
   * 選択中の状態が分かるツールリンクを描画する。
   * @param tool 登録済みツール。
   * @returns ツールの専用URLへのリンク。
   */
  function renderToolLink(tool: ToolDefinition) {
    const isCurrent = pathname === tool.href;
    return (
      <a key={tool.id} href={tool.href} onClick={onNavigate}
        aria-current={isCurrent ? 'page' : undefined}
        className={`my-1 flex items-center gap-3 rounded px-3 py-2.5 text-sm hover:bg-elevated ${isCurrent ? 'bg-selection text-accent' : 'text-muted'}`}>
        <Icon name="box" className="size-4 shrink-0" />
        <span className="break-all">{tool.name}</span>
      </a>
    );
  }

  return (
    <nav aria-label="メインメニュー" className="flex-1 overflow-y-auto px-3 py-6">
      <p className="mb-3 px-3 text-[10px] font-semibold tracking-[.18em] text-muted">ワークスペース</p>
      <a href="/" onClick={onNavigate} aria-current={pathname === '/' ? 'page' : undefined}
        className={`flex items-center gap-3 rounded border-l-2 px-3 py-2.5 text-sm ${pathname === '/' ? 'border-accent bg-selection font-medium text-ink' : 'border-transparent text-muted hover:bg-elevated'}`}>
        <Icon name="home" className="size-4" />
        ホーム
      </a>
      <div className="mt-8 flex items-center justify-between px-3 text-[10px] font-semibold tracking-[.18em] text-muted">
        <span>ツール</span>
        <span className="rounded bg-elevated px-1.5 py-0.5 text-xs tracking-normal">{tools.length}</span>
      </div>
      {categories.map(renderCategory)}
      {tools.length === 0 && (
        <p className="px-3 pt-4 text-xs leading-6 text-muted">
          登録されたツールはありません。<br />
          追加したツールがここに並びます。
        </p>
      )}
    </nav>
  );
}
