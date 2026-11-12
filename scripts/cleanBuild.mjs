import { existsSync, lstatSync, readdirSync, rmdirSync, unlinkSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectDirectory = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const outputDirectory = join(projectDirectory, 'dist');

/**
 * ビルド出力だけを削除する。Windows上の再帰的なrmSyncによる異常終了を避ける。
 * シンボリックリンクはリンク自体を削除し、リンク先には移動しない。
 * @param target 削除するdist内のファイルまたはフォルダーの絶対パス。
 * @throws 対象がdistの外側にある場合、またはファイル操作に失敗した場合。
 */
function removeBuildEntry(target) {
  const relativeTarget = resolve(target);
  if (relativeTarget !== outputDirectory && !relativeTarget.startsWith(`${outputDirectory}/`) && !relativeTarget.startsWith(`${outputDirectory}\\`)) {
    throw new Error('ビルド出力の外側は削除できません。');
  }

  const entry = lstatSync(target);
  if (entry.isSymbolicLink() || !entry.isDirectory()) {
    unlinkSync(target);
    return;
  }

  for (const name of readdirSync(target)) {
    removeBuildEntry(join(target, name));
  }
  rmdirSync(target);
}

if (existsSync(outputDirectory)) {
  removeBuildEntry(outputDirectory);
}
