import { useState } from 'react';
import type { FormEvent } from 'react';
import type { GroupDirectory } from '../../../shared/groups';
import { Modal, primaryStyle, secondaryStyle } from '../../shared/components/Modal';
import type { SaveGroup } from './GroupRow';

/** @param props 対象ユーザーと設定。 @returns 複数の所属先を選ぶダイアログ。 */
export function MembershipDialog({ user, data, busy, error, save, onClose }: {
  user: { id: string; name: string }; data: GroupDirectory; busy: boolean; error: string;
  save: SaveGroup; onClose: () => void;
}) {
  const initial = data.memberships.filter(/** @param item 所属。 @returns 対象ユーザーか。 */ (item) => item.userId === user.id)
    .map(/** @param item 所属。 @returns グループID。 */ (item) => item.groupId);
  const [selected, setSelected] = useState(initial);

  /** @param id 選択先。 @param checked 選択状態。チェックした所属先だけを下書きにする。 */
  function toggle(id: string, checked: boolean) {
    setSelected(checked ? [...selected, id] : selected.filter(/** @param item 候補ID。 @returns 対象以外か。 */ (item) => item !== id));
  }

  /** @param event 保存操作。管理者APIで所属を置き換える。 */
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (await save(`/api/admin/users/${user.id}/groups`, 'PUT', { groupIds: selected })) onClose();
  }

  return (
    <Modal title={`${user.name}の所属グループ`} busy={busy} onClose={onClose}>
      <p className="mb-4 text-sm leading-6 text-muted">複数選択できます。Public予定は所属先すべてに共有されます。未選択なら他人のPublic予定も閲覧できません。</p>
      <form onSubmit={submit} className="space-y-4">
        <fieldset disabled={busy} className="space-y-3">
          {data.groups.map(/** @param group 選択先。 @returns 所属のチェック欄。 */ (group) => (
            <label key={group.id} className="flex items-center gap-3 rounded border border-line p-3 text-sm">
              <input type="checkbox" checked={selected.includes(group.id)}
                onChange={/** 所属先を切り替える。 @param event チェック変更。 */ (event) => toggle(group.id, event.target.checked)} />
              <span className="break-all">{group.name}</span>
            </label>
          ))}
          {data.groups.length === 0 && <p className="text-sm text-muted">先にグループを作成してください。</p>}
        </fieldset>
        {error && <p role="alert" className="text-sm text-danger">{error}</p>}
        <div className="flex justify-end gap-2">
          <button type="button" disabled={busy} onClick={onClose} className={secondaryStyle}>キャンセル</button>
          <button type="submit" disabled={busy} className={primaryStyle}>所属を保存</button>
        </div>
      </form>
    </Modal>
  );
}
