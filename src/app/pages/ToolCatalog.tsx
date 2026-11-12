import type { ToolDefinition } from '../../tools/registry';
import { Icon } from '../../shared/components/Icon';

interface ToolCatalogProps {
  tools: readonly ToolDefinition[];
  hasRegisteredTools: boolean;
  onReset: () => void;
}

/**
 * 検索済みのツール一覧、または登録・検索の空状態を表示する。
 * @param props 表示するツールと検索のリセット処理。
 * @returns ツールカードまたは空状態の案内。
 */
export function ToolCatalog({ tools, hasRegisteredTools, onReset }: ToolCatalogProps) {
  if (tools.length > 0) {
    return <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">{tools.map(renderToolCard)}</div>;
  }

  return (
    <div className="flex min-h-80 flex-col items-center justify-center rounded-lg border border-dashed border-line bg-panel/40 px-6 py-14 text-center">
      <span className="mb-6 grid size-16 place-items-center rounded-2xl border border-line bg-elevated text-accent">
        <Icon name={hasRegisteredTools ? 'search' : 'box'} className="size-8" />
      </span>
      <h3 className="text-lg font-semibold">
        {hasRegisteredTools ? '条件に合うツールがありません' : '最初のツールを迎える準備ができました'}
      </h3>
      <p className="mt-3 max-w-md text-sm leading-7 text-muted">
        {hasRegisteredTools ? 'キーワードやカテゴリーを変更して、もう一度お試しください。' : 'ここは、日々の作業を少し楽にする道具箱。追加したツールがこの一覧とサイドメニューに並びます。'}
      </p>
      {hasRegisteredTools ? (
        <button type="button" onClick={onReset} className="mt-6 rounded border border-line bg-elevated px-4 py-2 text-sm hover:border-accent">
          検索条件をクリア
        </button>
      ) : (
        <span className="mt-6 flex items-center gap-2 text-xs text-muted">
          <Icon name="grid" className="size-3.5" />
          ツールはまだ登録されていません
        </span>
      )}
    </div>
  );
}

/**
 * 実装済みのツールへ移動するカードを描画する。
 * @param tool カードに表示するツール情報。
 * @returns 名前・説明・カテゴリーを持つリンク。
 */
function renderToolCard(tool: ToolDefinition) {
  return (
    <a key={tool.id} href={tool.href} className="group rounded-lg border border-line bg-panel p-6 transition-colors hover:border-accent">
      <div className="mb-5 flex items-center justify-between text-accent">
        <Icon name="box" />
        <Icon name="arrow" className="size-4 transition-transform group-hover:translate-x-1" />
      </div>
      <p className="text-xs text-muted">{tool.category}</p>
      <h3 className="mt-2 font-semibold">{tool.name}</h3>
      <p className="mt-3 text-sm leading-6 text-muted">{tool.description}</p>
    </a>
  );
}
