import { useState } from 'react';
import type { FormEvent } from 'react';
import { fieldStyle, primaryStyle, secondaryStyle } from '../../shared/components/Modal';
import { useGroupAdmin } from './useGroupAdmin';
import { GroupRow } from './GroupRow';
import { MembershipDialog } from './MembershipDialog';

interface User { id: string; name: string }

/** @param props 管理画面のユーザー一覧。 @returns グループの作成・編集と所属設定。 */
export function AdminGroupsPanel({ users }: { users: User[] }) {
  const admin = useGroupAdmin(users.map(/** @param user 対象。 @returns ユーザーID。 */ (user) => user.id));
  const [editing, setEditing] = useState<User | null>(null);

  /** @param event 作成フォーム。新しいグループを作成する。 */
  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const name = String(new FormData(form).get('name')).trim();
    if (await admin.save('/api/admin/groups', 'POST', { name })) form.reset();
  }

  /** @param user 対象ユーザー。 @returns 現在の所属名。 */
  function membershipNames(user: User) {
    if (!admin.data) return '';
    const ids = new Set(admin.data.memberships.filter(/** @param item 所属。 @returns このユーザーか。 */ (item) => item.userId === user.id)
      .map(/** @param item 所属。 @returns グループID。 */ (item) => item.groupId));
    return admin.data.groups.filter(/** @param group 候補。 @returns 所属先か。 */ (group) => ids.has(group.id))
      .map(/** @param group 所属先。 @returns 名前。 */ (group) => group.name).join('、') || '未所属';
  }

  return (
    <section className="mt-8 rounded-lg border border-line bg-panel p-5" aria-labelledby="group-heading">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="group-heading" className="font-semibold">グループと所属の管理</h2>
        <button type="button" disabled={admin.busy} onClick={admin.reload} className={secondaryStyle}>設定を再読み込み</button>
      </div>
      <p className="mt-3 text-sm leading-6 text-muted">設定できるのは管理者本人だけです。共通グループがあるユーザー同士でPublic予定を閲覧できます。</p>
      {admin.loading && <p role="status" className="mt-3 text-sm text-muted">設定を読み込み中…</p>}
      {admin.error && <p role="alert" className="mt-3 text-sm text-danger">{admin.error}</p>}
      {admin.data && <>
        <form onSubmit={create} className="my-5 flex flex-wrap items-end gap-3">
          <label className="min-w-0 flex-1 text-sm">新しいグループ名
            <input name="name" required maxLength={60} disabled={admin.busy} className={fieldStyle} />
          </label>
          <button type="submit" disabled={admin.busy || admin.data.groups.length >= 30} className={primaryStyle}>グループを作成</button>
        </form>
        <div className="space-y-3">
          {admin.data.groups.map(/** @param group 設定対象。 @returns グループ編集行。 */ (group) => (
            <GroupRow key={`${group.id}:${group.name}`} group={group} busy={admin.busy} save={admin.save} />
          ))}
        </div>
        <h3 className="mb-3 mt-6 text-sm font-semibold">ユーザーの所属先（複数選択可）</h3>
        <div className="divide-y divide-line">
          {users.map(/** @param user 設定対象。 @returns 所属名と変更ボタン。 */ (user) => (
            <div key={user.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
              <div className="min-w-0">
                <p className="break-all text-sm font-semibold">{user.name}</p>
                <p className="mt-1 break-all text-xs text-muted">{membershipNames(user)}</p>
              </div>
              <button type="button" disabled={admin.busy} className={secondaryStyle}
                onClick={/** 所属変更画面を開く。 */ () => setEditing(user)} aria-label={`${user.name}の所属を変更`}>所属を変更</button>
            </div>
          ))}
        </div>
      </>}
      {editing && admin.data && <MembershipDialog user={editing} data={admin.data} busy={admin.busy}
        error={admin.error} save={admin.save} onClose={/** 所属の編集を閉じる。 */ () => setEditing(null)} />}
    </section>
  );
}
