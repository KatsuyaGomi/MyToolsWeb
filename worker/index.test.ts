import assert from 'node:assert/strict';
import test from 'node:test';
import { handleRequest } from './index.ts';

/** 公開の疎通確認APIがキャッシュされないJSONを返すことを確認する。 */
async function returnsHealth() {
  const response = await handleRequest(new Request('https://example.com/api/health'));
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('Cache-Control'), 'no-store');
  assert.deepEqual(await response.json(), { status: 'ok' });
}

/** 認証設定がない場合に個人用APIを公開しないことを確認する。 */
async function rejectsMissingConfiguration() {
  const response = await handleRequest(new Request('https://example.com/api/me'));
  assert.equal(response.status, 503);
  assert.equal(response.headers.get('Cache-Control'), 'no-store');
}

/** 疎通確認APIが未対応のメソッドを拒否することを確認する。 */
async function rejectsUnsupportedMethod() {
  const response = await handleRequest(new Request('https://example.com/api/health', { method: 'POST' }));
  assert.equal(response.status, 405);
  assert.equal(response.headers.get('Allow'), 'GET, HEAD');
}

/** HEADの応答が本文を持たないことを確認する。 */
async function returnsHeadWithoutBody() {
  const response = await handleRequest(new Request('https://example.com/api/health', { method: 'HEAD' }));
  assert.equal(response.status, 200);
  assert.equal(await response.text(), '');
}

test('health endpoint returns JSON without caching', returnsHealth);
test('personal API fails closed without configuration', rejectsMissingConfiguration);
test('health endpoint rejects unsupported methods', rejectsUnsupportedMethod);
test('HEAD health response has no body', returnsHeadWithoutBody);
