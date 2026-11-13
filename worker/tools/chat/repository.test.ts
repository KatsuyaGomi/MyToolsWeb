import assert from 'node:assert/strict';
import { test } from 'bun:test';
import { chatFixture, actor } from './fixture.test.ts';
import { createMessage, changeMessage } from './mutations.ts';
import { listRooms, markRead, readMessages } from './queries.ts';

/** 所属・所有権・再送・版競合・差分削除を確認する。 */
async function protectsGroupHistory() {
  const { db, sqlite } = chatFixture();
  try {
    const message = (await createMessage(db, 'room-a', actor(), 'こんにちは😊\n<script>文字のまま</script>', 'unique-client-id-0001'))!;
    assert.ok(message);
    assert.equal((await createMessage(db, 'room-a', actor(), '再送', 'unique-client-id-0001'))!.id, message.id);
    assert.equal(sqlite.query<{ n: number }, []>('SELECT count(*) AS n FROM chatPushJob').get()!.n, 1);
    assert.equal(await createMessage(db, 'room-a', actor(), '連打', 'unique-client-id-0002'), null);
    assert.equal(await createMessage(db, 'room-a', actor('carol'), '侵入', 'unique-client-id-0003'), null);
    assert.equal(await readMessages(db, 'room-a', 'carol', {}), null);
    assert.equal((await listRooms(db, 'bob'))[0].unread, 1);
    assert.equal(await changeMessage(db, 'room-a', actor('bob'), message.id, 0, '他人の編集'), 404);
    assert.equal(await changeMessage(db, 'room-a', actor('bob', true), message.id, 0, '管理者の編集'), 404);
    assert.equal(await changeMessage(db, 'room-a', actor(), message.id, 0, '変更後😊'), 200);
    assert.equal(await changeMessage(db, 'room-a', actor(), message.id, 0, '競合'), 409);
    const changed = (await readMessages(db, 'room-a', 'bob', { since: 1 }))!;
    assert.equal(changed.messages[0].body, '変更後😊');
    assert.equal(changed.version, 2);
    assert.equal(await changeMessage(db, 'room-a', actor('bob', true), message.id, 1, null), 200);
    const removed = (await readMessages(db, 'room-a', 'bob', { since: 2 }))!.messages[0];
    assert.equal(removed.body, '');
    assert.ok(removed.deletedAt);
    sqlite.exec("DELETE FROM groupMembership WHERE userId='bob'");
    assert.equal(await readMessages(db, 'room-a', 'bob', {}), null);
    assert.equal(await changeMessage(db, 'room-a', actor('bob', true), message.id, 2, null), 404);
    sqlite.exec("INSERT INTO groupMembership VALUES ('bob','team-a')");
    assert.equal((await readMessages(db, 'room-a', 'bob', {}))!.messages.length, 1, '再加入後も過去履歴を読める');
  } finally { sqlite.close(); }
}

/** ページング、古い投稿の編集、既読の単調性と部屋の分離を確認する。 */
async function paginatesAndTracksReaders() {
  const { db, sqlite } = chatFixture();
  try {
    const insert = sqlite.prepare(`INSERT INTO chatMessage(roomId,authorId,authorName,clientId,body,changeId,createdAt)
      VALUES('room-a','alice','アリス',?,?,?,0)`);
    for (let index = 1; index <= 260; index++) insert.run(`seed-${index}`, `本文${index}`, index);
    sqlite.exec('UPDATE chatRoom SET version=260 WHERE id=\'room-a\'');
    const newest = (await readMessages(db, 'room-a', 'bob', {}))!;
    assert.equal(newest.messages.length, 50);
    assert.equal(newest.messages[0].id, 211);
    assert.equal(newest.hasMore, true);
    const older = (await readMessages(db, 'room-a', 'bob', { before: 211 }))!;
    assert.equal(older.messages.at(-1)!.id, 210);
    const firstDiff = (await readMessages(db, 'room-a', 'bob', { since: 0 }))!;
    assert.equal(firstDiff.hasMore, true);
    assert.equal(firstDiff.version, 201);
    assert.equal((await readMessages(db, 'room-a', 'bob', { since: 201 }))!.messages.length, 59);
    await markRead(db, 'room-a', 'bob', 260);
    await markRead(db, 'room-a', 'bob', 10);
    await markRead(db, 'room-a', 'bob', 999);
    await markRead(db, 'room-a', 'carol', 260);
    const readers = (await readMessages(db, 'room-a', 'alice', {}))!.readers;
    assert.equal(readers.find(/** @param reader 候補。 @returns ボブか。 */ (reader) => reader.id === 'bob')!.lastReadId, 260);
    assert.equal((await listRooms(db, 'bob'))[0].unread, 0);
    assert.equal(await changeMessage(db, 'room-a', actor(), 1, 0, '古い本文の変更'), 200);
    assert.equal((await readMessages(db, 'room-a', 'bob', { since: 260 }))!.messages[0].id, 1);
  } finally { sqlite.close(); }
}

test('チャット: グループ制限・再送・所有権・競合・削除', protectsGroupHistory);
test('チャット: 履歴ページ・差分の取りこぼし防止・既読者', paginatesAndTracksReaders);
