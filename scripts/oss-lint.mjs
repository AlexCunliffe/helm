#!/usr/bin/env node
/** Check every tracked file against an external, case-insensitive regex denylist. */
import { execFileSync } from 'node:child_process';
import { lstatSync, readFileSync, realpathSync } from 'node:fs';
import { isAbsolute, relative, resolve, sep } from 'node:path';

try {
  if (process.argv.length !== 3) throw new Error('Usage: node scripts/oss-lint.mjs <external-denylist>');
  const root = realpathSync(execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' }).trim());
  const denyPath = realpathSync(resolve(process.argv[2]));
  const denyRelative = relative(root, denyPath);
  if (denyRelative === '' || (!isAbsolute(denyRelative) && denyRelative !== '..' && !denyRelative.startsWith('..' + sep))) {
    throw new Error('Keep the denylist outside this repository.');
  }
  const patterns = readFileSync(denyPath, 'utf8').split(/\r?\n/).filter(line => line.trim() && !line.startsWith('#'));
  if (!patterns.length) throw new Error('The denylist is empty.');
  const checks = patterns.map(pattern => ({ pattern, regex: new RegExp(pattern, 'i') }));
  const files = execFileSync('git', ['ls-files', '--cached', '-z'], { cwd: root, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 }).split('\0').filter(Boolean);
  if (!files.length) throw new Error('No tracked files. Stage the import before checking it.');
  let hits = 0;
  for (const file of new Set(files)) {
    const path = resolve(root, file);
    if (!lstatSync(path).isFile()) throw new Error(`Unsupported tracked entry: ${file}`);
    const lines = readFileSync(path, 'utf8').split(/\r?\n/);
    for (const [index, line] of lines.entries()) {
      for (const { pattern, regex } of checks) {
        if (regex.test(line)) {
          console.log(`${file}:${index + 1}: ${pattern}`);
          hits++;
        }
      }
    }
  }
  console.log(`oss-lint: ${files.length} tracked files; ${hits} hits.`);
  process.exitCode = hits ? 1 : 0;
} catch (error) {
  console.error(`oss-lint: ${error.message}`);
  process.exitCode = 1;
}
