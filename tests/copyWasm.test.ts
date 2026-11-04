// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { spawnSync } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

describe('copy_wasm', () => {
  it('exits 1 naming the path when the build is missing', () => {
    // A copy of the script in a folder with no build: it resolves its paths from where it sits.
    // `.mjs`, since the temp folder has no package.json to make `.js` a module
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'copy-wasm-'));
    try {
      fs.mkdirSync(path.join(root, 'scripts'));
      const script = path.join(root, 'scripts', 'copy_wasm.mjs');
      fs.copyFileSync(path.resolve(__dirname, '../scripts/copy_wasm.js'), script);

      const run = spawnSync(process.execPath, [script], { encoding: 'utf8' });

      const expected = path.join(root, 'engine', 'target', 'wasm32-unknown-unknown', 'release', 'metrorig_audio.wasm');
      expect(run.status).toBe(1);
      expect(run.stderr).toContain(`not found at: ${expected}`);
      expect(fs.existsSync(path.join(root, 'public'))).toBe(false);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });
});
