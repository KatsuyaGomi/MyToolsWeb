import { useState } from 'react';
import type { FormEvent } from 'react';
import { Modal, fieldStyle, primaryStyle, secondaryStyle } from '../../../shared/components/Modal';
import { isCalendarTime } from '../types';
import type { CalendarEvent, CalendarInput, CalendarVisibility } from '../types';

interface Props {
  day: string;
  event?: CalendarEvent;
  busy: boolean;
  error: string;
  save: (input: CalendarInput | null, event?: CalendarEvent) => Promise<boolean>;
  onClose: () => void;
}

/**
 * 自分の予定を編集し、他人のPublic予定は登録者名付きで閲覧する。
 * @param props 対象予定と保存操作。
 * @returns 予定の詳細ダイアログ。
 */
export function EventDialog({ day, event, busy, error, save, onClose }: Props) {
  const [validationError, setValidationError] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const readonly = event !== undefined && !event.isOwner;
  const [visibility, setVisibility] = useState<CalendarVisibility>(event?.visibility ?? 'private');

  /** @param action フォーム送信。5分単位を検証して保存する。 */
  async function submit(action: FormEvent<HTMLFormElement>) {
    action.preventDefault();
    const form = new FormData(action.currentTarget);
    const input: CalendarInput = {
      title: String(form.get('title')).trim(), description: String(form.get('description')),
      startAt: String(form.get('startAt')), endAt: String(form.get('endAt')), visibility,
    };
    if (!isCalendarTime(input.startAt) || !isCalendarTime(input.endAt) || input.endAt <= input.startAt) {
      setValidationError('日時は5分単位で指定し、終了を開始より後にしてください。');
      return;
    }
    if (!input.title) {
      setValidationError('タイトルを入力してください。');
      return;
    }
    setValidationError('');
    if (await save(input, event)) onClose();
  }

  /** 本人の予定を確認後に削除する。 */
  async function remove() {
    if (event && await save(null, event)) onClose();
  }

  return (
    <Modal title={event ? '予定の詳細' : '予定を追加'} busy={busy} onClose={onClose}>
      {event && <p className="mb-4 text-sm text-muted">登録者: <span className="font-semibold text-ink">{event.ownerName}</span>{event.isOwner ? '（自分）' : ''}</p>}
      {readonly && <p className="mb-4 rounded bg-accent/10 p-3 text-sm text-accent">Publicの予定です。編集・削除は登録者本人のみ行えます。</p>}
      <form onSubmit={submit} className="space-y-4">
        <fieldset disabled={busy || readonly} className="space-y-4 disabled:opacity-85">
          <label className="block text-sm">タイトル（必須）
            <input required name="title" maxLength={200} defaultValue={event?.title ?? ''} className={fieldStyle} />
          </label>
          <label className="block text-sm">説明
            <textarea name="description" maxLength={4000} rows={3} defaultValue={event?.description ?? ''} className={fieldStyle} />
          </label>
          <label className="block text-sm">開始（日本時間・5分単位）
            <input required name="startAt" type="datetime-local" step={300} defaultValue={event?.startAt ?? `${day}T09:00`} className={fieldStyle} />
          </label>
          <label className="block text-sm">終了（日本時間・5分単位）
            <input required name="endAt" type="datetime-local" step={300} defaultValue={event?.endAt ?? `${day}T10:00`} className={fieldStyle} />
          </label>
          <label className="block text-sm">公開範囲
            <select name="visibility" value={visibility} className={fieldStyle}
              onChange={/** 公開範囲と案内を更新する。 @param action 選択変更。 */ (action) => setVisibility(action.target.value as CalendarVisibility)}>
              <option value="private">Private — 自分のみ</option>
              <option value="public">Public — アプリ使用者全員</option>
            </select>
          </label>
          <p className="text-sm leading-6 text-muted">{visibility === 'public' ? 'タイトル・説明・日時・登録者名が、ログインした全ユーザーに表示されます。' : '登録した本人だけが閲覧できます。'}</p>
        </fieldset>
        {(validationError || error) && <p role="alert" className="text-sm text-danger">{validationError || error}</p>}
        <div className="flex flex-wrap items-center justify-end gap-3 border-t border-line pt-4">
          {event?.isOwner && !confirmDelete && <button type="button" disabled={busy} className="mr-auto text-sm text-danger"
            onClick={/** 削除確認を開く。 */ () => setConfirmDelete(true)}>削除する</button>}
          <button type="button" disabled={busy} onClick={onClose} className={secondaryStyle}>閉じる</button>
          {!readonly && <button type="submit" disabled={busy} className={primaryStyle}>{busy ? '保存中…' : '保存する'}</button>}
        </div>
        {confirmDelete && <div className="rounded border border-danger/40 p-3 text-sm">
          <p>この予定を削除しますか？</p>
          <button type="button" disabled={busy} onClick={remove} className="mt-3 rounded bg-danger px-3 py-2 text-canvas">削除を確定</button>
        </div>}
      </form>
    </Modal>
  );
}
