import { createRequire } from 'node:module';

// Bun内蔵のundici互換fetchはMiniflareのカスタムdispatcherを扱えない。
// 開発CLIのプロセス内だけで、既存の公式Undici実装へ差し替える。
// Workers本番のコードやグローバルfetchは変更しない。
// 参考: https://github.com/cloudflare/workers-sdk/issues/15717
const require = createRequire(import.meta.url);
if (process.versions.bun) {
  Object.assign(require('undici'), require('undici/index.js'));
}
