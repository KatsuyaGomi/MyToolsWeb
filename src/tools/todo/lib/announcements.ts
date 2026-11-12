import type { Announcements } from '@dnd-kit/core';

// 内部IDを読み上げず、操作と確定状態を日本語で伝える。
export const announcements: Announcements = {
  /** @returns 操作開始の案内。 */
  onDragStart() {
    return 'タスクを持ち上げました。矢印キーで移動し、Spaceで確定できます。';
  },
  /** @param event ドロップ候補。 @returns 移動先の案内。 */
  onDragOver({ over }) {
    return over ? '移動先を選択しています。Spaceで確定します。' : '移動できる場所の外です。';
  },
  /** @param event ドロップ結果。 @returns 確定操作の案内。 */
  onDragEnd({ over }) {
    return over ? 'タスクの移動を確定しました。保存結果は画面の状態表示を確認してください。' : '移動を取り消しました。';
  },
  /** @returns 中止の案内。 */
  onDragCancel() {
    return '移動を取り消しました。';
  },
};
