import { mkdir, readFile, writeFile } from 'node:fs/promises';

/**
 * Web Push用のP-256鍵を、Git除外済みファイルへ保存する。既存の鍵は上書きしない。
 * @throws 出力先の指定が不正、または既存ファイルの設定が不完全な場合。
 */
async function createChatKeys() {
  const mode = process.argv[2];
  if (!['--local', '--production'].includes(mode)) throw new Error('--local または --production を指定してください。');
  const target = mode === '--local' ? '.dev.vars' : '.wrangler/chat-vapid-production.env';
  let previous = '';
  try { previous = await readFile(target, 'utf8'); }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
  if (/^VAPID_(PUBLIC_KEY|PRIVATE_KEY|SUBJECT)=/m.test(previous)) {
    if (!['PUBLIC_KEY', 'PRIVATE_KEY', 'SUBJECT'].every(/** @param name 設定名。 @returns 既存値があるか。 */ (name) => new RegExp(`^VAPID_${name}=.+`, 'm').test(previous))) {
      throw new Error('VAPID設定が一部だけ存在します。既存値を確認してください。');
    }
    console.log('通知用の鍵は設定済みです。上書きしません。');
    return;
  }
  const pair = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
  const publicKey = Buffer.from(await crypto.subtle.exportKey('raw', pair.publicKey)).toString('base64url');
  const privateKey = (await crypto.subtle.exportKey('jwk', pair.privateKey)).d;
  if (mode === '--production') await mkdir('.wrangler', { recursive: true });
  await writeFile(target, `${previous}\nVAPID_PUBLIC_KEY=${publicKey}\nVAPID_PRIVATE_KEY=${privateKey}\nVAPID_SUBJECT=https://my-tools-web.katsu05131990.workers.dev\n`, { mode: 0o600 });
  console.log(`通知用の鍵を ${target} に保存しました。鍵の値はログへ表示しません。`);
}

await createChatKeys();
