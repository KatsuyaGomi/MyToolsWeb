import assert from 'node:assert/strict';
import { spyOn, test } from 'bun:test';
import { chatFixture, actor } from './fixture.test.ts';
import { createMessage } from './mutations.ts';
import { deliverPush } from './pushDelivery.ts';
import { saveDevice, validPushEndpoint } from './pushDevices.ts';
import type { Env } from '../../env.ts';

/** @returns 暗号化とVAPIDに使うテスト専用の鍵。保存しない。 */
async function keys() {
  const pair = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']) as CryptoKeyPair;
  const publicKey = Buffer.from(await crypto.subtle.exportKey('raw', pair.publicKey)).toString('base64url');
  const privateKey = (await crypto.subtle.exportKey('jwk', pair.privateKey) as JsonWebKey).d!;
  return { publicKey, privateKey };
}

/** 標準配信先だけを受け付け、鍵・端末・セッションの紐付けを検証する。 */
async function validatesSubscriptions() {
  const { db, sqlite } = chatFixture();
  try {
    assert.ok(validPushEndpoint('https://fcm.googleapis.com/fcm/send/test'));
    assert.ok(validPushEndpoint('https://web.push.apple.com/test'));
    assert.ok(validPushEndpoint('https://updates.push.services.mozilla.com/test'));
    for (const endpoint of ['http://fcm.googleapis.com/test', 'https://127.0.0.1/test',
      'https://fcm.googleapis.com.evil.test/test', 'https://a@fcm.googleapis.com/test', 'https://fcm.googleapis.com:8080/test']) {
      assert.equal(validPushEndpoint(endpoint), false);
    }
    await assert.rejects(saveDevice(db, actor('bob'), { id: 'device-bob-000001', subscription: { endpoint: 'https://127.0.0.1' } }));
    const key = await keys();
    const subscription = { endpoint: 'https://fcm.googleapis.com/test', keys: { p256dh: key.publicKey, auth: Buffer.alloc(16, 1).toString('base64url') } };
    await saveDevice(db, actor('bob'), { id: 'device-bob-000001', subscription });
    assert.equal(sqlite.query<{ sessionId: string }, []>('SELECT sessionId FROM chatDevice').get()!.sessionId, 'session-bob');
    await saveDevice(db, actor(), { id: 'device-alice-0001', subscription });
    assert.equal(sqlite.query<{ n: number }, []>('SELECT count(*) AS n FROM chatDevice').get()!.n, 1, '同じ購読のアカウント切替で古い登録を残さない');
    sqlite.exec("DELETE FROM session WHERE id='session-alice'");
    assert.equal(sqlite.query<{ n: number }, []>('SELECT count(*) AS n FROM chatDevice').get()!.n, 0);
  } finally { sqlite.close(); }
}

/** 暗号化、失敗再試行、ミュート、失効・所属解除・表示中の除外を確認する。 */
async function deliversOnlyToEligibleDevices() {
  const { db, sqlite } = chatFixture();
  const fetchMock = spyOn(globalThis, 'fetch').mockResolvedValue(new Response(null, { status: 201 }));
  try {
    const vapid = await keys();
    const recipient = await keys();
    const env: Env = { DB: db, VAPID_PUBLIC_KEY: vapid.publicKey, VAPID_PRIVATE_KEY: vapid.privateKey, VAPID_SUBJECT: 'https://example.test' };
    await saveDevice(db, actor('bob'), { id: 'device-bob-000001', subscription: {
      endpoint: 'https://fcm.googleapis.com/test', keys: { p256dh: recipient.publicKey, auth: Buffer.alloc(16, 2).toString('base64url') },
    } });
    const message = (await createMessage(db, 'room-a', actor(), '通知本文😊', 'push-client-id-0001'))!;
    /** 同じ投稿の通知ジョブを再び待機状態にする。 */
    function resetJob() {
      sqlite.prepare('INSERT OR REPLACE INTO chatPushJob(messageId,attempts,nextAttemptAt) VALUES(?,0,0)').run(message.id);
      fetchMock.mockClear();
    }
    await deliverPush(env, message.id);
    assert.equal(fetchMock.mock.calls.length, 1, '非表示端末へ配信する');
    const options = fetchMock.mock.calls[0][1]!;
    assert.equal(new Headers(options.headers).get('Content-Encoding'), 'aes128gcm');
    assert.equal(new TextDecoder().decode(options.body as Uint8Array).includes('通知本文'), false);
    resetJob();
    sqlite.exec("INSERT INTO chatMute VALUES('room-a','bob',1)");
    await deliverPush(env, message.id);
    assert.equal(fetchMock.mock.calls.length, 0);
    sqlite.exec('DELETE FROM chatMute');
    resetJob();
    sqlite.exec("UPDATE chatDevice SET activeRoomId='room-a',activeUntil=9999999999999");
    await deliverPush(env, message.id);
    assert.equal(fetchMock.mock.calls.length, 0);
    sqlite.exec('UPDATE chatDevice SET activeRoomId=NULL,activeUntil=0');
    resetJob();
    sqlite.exec("UPDATE session SET expiresAt=0 WHERE id='session-bob'");
    await deliverPush(env, message.id);
    assert.equal(fetchMock.mock.calls.length, 0);
    sqlite.exec("UPDATE session SET expiresAt=9999999999999 WHERE id='session-bob'");
    resetJob();
    sqlite.exec("DELETE FROM groupMembership WHERE userId='bob'");
    await deliverPush(env, message.id);
    assert.equal(fetchMock.mock.calls.length, 0);
    sqlite.exec("INSERT INTO groupMembership VALUES('bob','team-a')");
    resetJob();
    fetchMock.mockResolvedValue(new Response(null, { status: 503 }));
    await deliverPush(env, message.id);
    assert.equal(sqlite.query<{ attempts: number }, []>('SELECT attempts FROM chatPushJob').get()!.attempts, 1, '失敗したジョブを保存する');
    sqlite.exec('UPDATE chatPushJob SET nextAttemptAt=0');
    fetchMock.mockResolvedValue(new Response(null, { status: 410 }));
    await deliverPush(env);
    assert.equal(sqlite.query<{ n: number }, []>('SELECT count(*) AS n FROM chatDevice').get()!.n, 0, '失効した購読を除去する');
  } finally {
    fetchMock.mockRestore();
    sqlite.close();
  }
}
test('通知: 配信先の検証とセッションへの購読紐付け', validatesSubscriptions);
test('通知: 暗号化・配信資格・失敗再試行', deliversOnlyToEligibleDevices);
