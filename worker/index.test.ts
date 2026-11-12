import assert from 'node:assert/strict';
import test from 'node:test';
import { handleRequest } from './index.ts';

test('health endpoint returns JSON without caching', async () => {
  const response = handleRequest(new Request('https://example.com/api/health'));
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('Cache-Control'), 'no-store');
  assert.deepEqual(await response.json(), { status: 'ok' });
});

test('unknown API returns 404 rather than the SPA', () => {
  const response = handleRequest(new Request('https://example.com/api/missing'));
  assert.equal(response.status, 404);
});

test('health endpoint rejects unsupported methods', () => {
  const response = handleRequest(new Request('https://example.com/api/health', { method: 'POST' }));
  assert.equal(response.status, 405);
  assert.equal(response.headers.get('Allow'), 'GET, HEAD');
});

test('HEAD health response has no body', async () => {
  const response = handleRequest(new Request('https://example.com/api/health', { method: 'HEAD' }));
  assert.equal(response.status, 200);
  assert.equal(await response.text(), '');
});
