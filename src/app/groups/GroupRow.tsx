import { useState } from 'react';
import type { FormEvent } from 'react';
import type { ManagedGroup } from '../../../shared/groups';
import { fieldStyle, secondaryStyle } from '../../shared/components/Modal';

export type SaveGroup = (path: string, method: 'POST' | 'PUT' | 'DELETE', body: Record<string, unknown>) => Promise<boolean>;

/** @param props グループと保存操作。 @returns 名前変更・削除できる設定行。 */
export function GroupRow({ group, busy, save }: { group: ManagedGroup; busy: boolean; save: SaveGroup }) {
  const [confirmDelete, setConfirmDelete] = useState(false);

  /** @param event 名前変更フォーム。グループ名だけを保存する。 */
  async function rename(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = String(new FormData(event.currentTarget).get('name')).trim();
    await save(`/api/admin/groups/${group.id}`, 'PUT', { name });
  }

  /** 所属解除も含む削除を、確認後に実行する。 */
  async function remove() {
    await save(`/api/admin/groups/${group.id}`, 'DELETE', {});
  }

  return (
    <div className="rounded border border-line p-3">
      <form onSubmit={rename} className="flex flex-wrap items-end gap-2">
        <label className="min-w-0 flex-1 text-xs text-muted">グループ名（{group.memberCount}人）
          <input name="name" aria-label={`${group.name}のグループ名`} required maxLength={60} defaultValue={group.name} disabled={busy} className={fieldStyle} />
        </label>
        <button type="submit" disabled={busy} className={secondaryStyle}>名前を保存</button>
        <button type="button" disabled={busy} className="px-2 py-2 text-sm text-danger"
          onClick={/** 削除の影響を確認する。 */ () => setConfirmDelete(!confirmDelete)}>削除</button>
      </form>
      {confirmDelete && <div className="mt-3 text-sm">
        <p className="text-muted">「{group.name}」と全員の所属を削除します。このグループによるPublic予定の共有も解除されます。</p>
        <button type="button" disabled={busy} onClick={remove} className="mt-2 rounded bg-danger px-3 py-2 text-canvas">グループの削除を確定</button>
      </div>}
    </div>
  );
}
