import { useState } from 'react';
import type { ChangeEvent } from 'react';
import { tools } from '../../tools/registry';
import type { ToolDefinition } from '../../tools/registry';
import { Icon } from '../../shared/components/Icon';
import { ToolCatalog } from './ToolCatalog';

/**
 * 登録済みツールの概要、検索、カテゴリー別の一覧を表示する。
 * @returns ツールの利用開始地点となるホーム画面。
 */
export function HomePage() {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('');
  const categories = [...new Set(tools.map(getCategory))];
  const filteredTools = tools.filter(matchesFilters);
  const hasFilters = query.length > 0 || category.length > 0;

  /**
   * ツールからカテゴリー名を取り出す。
   * @param tool 登録済みツール。
   * @returns カテゴリー名。
   */
  function getCategory(tool: ToolDefinition) {
    return tool.category;
  }

  /**
   * キーワードと選択カテゴリーの両方に一致するか判定する。
   * @param tool 検索対象のツール。
   * @returns 両方の条件に一致する場合に真。
   */
  function matchesFilters(tool: ToolDefinition) {
    const searchText = `${tool.name} ${tool.description} ${tool.category}`.toLocaleLowerCase('ja');
    const matchesQuery = searchText.includes(query.trim().toLocaleLowerCase('ja'));
    return matchesQuery && (category === '' || tool.category === category);
  }

  /**
   * 検索入力の値を画面の状態へ反映する。
   * @param event 検索欄の変更イベント。
   */
  function handleQueryChange(event: ChangeEvent<HTMLInputElement>) {
    setQuery(event.target.value);
  }

  /**
   * 選択されたカテゴリーを画面の状態へ反映する。
   * @param event カテゴリー選択欄の変更イベント。
   */
  function handleCategoryChange(event: ChangeEvent<HTMLSelectElement>) {
    setCategory(event.target.value);
  }

  /** キーワードとカテゴリーの絞り込みを解除する。 */
  function resetFilters() {
    setQuery('');
    setCategory('');
  }

  /**
   * カテゴリー選択欄の選択肢を描画する。
   * @param value 選択肢にするカテゴリー名。
   * @returns カテゴリーの選択肢。
   */
  function renderCategoryOption(value: string) {
    return <option key={value} value={value}>{value}</option>;
  }

  return (
    <>
      <div className="flex h-12 items-center gap-2 border-b border-line px-6 text-xs text-muted lg:px-10" aria-label="現在の場所">
        <Icon name="grid" className="size-3.5" />
        <span>My Tools</span>
        <Icon name="chevron" className="size-3" />
        <span className="text-ink">ホーム</span>
      </div>
      <div className="mx-auto max-w-7xl px-5 py-8 sm:px-8 lg:px-10 lg:py-10">
        <div className="border-b border-line pb-6">
          <div className="mb-3 flex items-center gap-2 text-[10px] font-semibold tracking-[.16em] text-accent">
            <span className="size-1.5 rounded-full bg-accent" />
            PERSONAL WORKSPACE
          </div>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">ホーム</h1>
          <p className="mt-3 text-sm leading-7 text-muted">いつもの作業を、もっと手軽に。自分のためのツールをひとつの場所に。</p>
        </div>

        <div className="my-7 grid gap-3 sm:grid-cols-2">
          <div className="flex items-center gap-4 rounded-lg border border-line bg-panel px-5 py-4">
            <span className="rounded-lg bg-selection p-2.5 text-accent"><Icon name="box" /></span>
            <div>
              <p className="text-xs text-muted">登録済みツール</p>
              <p className="mt-1 text-2xl font-semibold tabular-nums">
                {tools.length}<span className="ml-2 text-xs font-normal text-muted">個</span>
              </p>
            </div>
          </div>
          <div className="flex items-center gap-4 rounded-lg border border-line bg-panel px-5 py-4">
            <span className="rounded-lg bg-elevated p-2.5 text-muted"><Icon name="grid" /></span>
            <div>
              <p className="text-xs text-muted">カテゴリー</p>
              <p className="mt-1 text-2xl font-semibold tabular-nums">
                {categories.length}<span className="ml-2 text-xs font-normal text-muted">種類</span>
              </p>
            </div>
          </div>
        </div>

        <section aria-labelledby="tools-title">
          <div className="mb-4 flex items-center gap-3">
            <h2 id="tools-title" className="text-base font-semibold">ツール一覧</h2>
            <span className="rounded bg-elevated px-2 py-0.5 text-xs text-muted">{tools.length}</span>
          </div>
          <div className="mb-5 flex flex-col gap-3 sm:flex-row">
            <label className="flex min-w-0 flex-1 items-center gap-3 rounded border border-line bg-panel px-3 focus-within:border-accent">
              <Icon name="search" className="size-4 shrink-0 text-muted" />
              <span className="sr-only">ツールを検索</span>
              <input type="search" value={query} onChange={handleQueryChange} placeholder="ツール名やキーワードで検索"
                className="min-w-0 flex-1 bg-transparent py-2.5 text-sm placeholder:text-muted focus-visible:outline-offset-0" />
            </label>
            <label className="sm:w-48">
              <span className="sr-only">カテゴリー</span>
              <select value={category} onChange={handleCategoryChange} className="w-full rounded border border-line bg-panel px-3 py-2.5 text-sm">
                <option value="">すべてのカテゴリー</option>
                {categories.map(renderCategoryOption)}
              </select>
            </label>
          </div>
          <ToolCatalog tools={filteredTools} hasRegisteredTools={tools.length > 0} onReset={resetFilters} />
          {hasFilters && tools.length === 0 && (
            <button type="button" onClick={resetFilters} className="mt-4 text-sm text-accent underline-offset-4 hover:underline">
              検索条件をクリア
            </button>
          )}
          <p role="status" className="mt-4 text-xs text-muted">
            {filteredTools.length} 件のツール{hasFilters ? 'が検索条件に一致' : 'を表示'}
          </p>
        </section>
        <footer className="mt-12 flex flex-wrap justify-between gap-3 border-t border-line pt-5 text-[11px] text-muted">
          <span>My Tools / パーソナル ワークスペース</span>
          <span>小さなツールで、日々の作業に余白を。</span>
        </footer>
      </div>
    </>
  );
}
