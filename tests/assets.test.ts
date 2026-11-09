// @vitest-environment node
import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { ENGINE_WASM, withBase } from '../src/domain/assets';

describe('withBase', () => {
  it('joins a base to a root path with one slash', () => {
    expect(withBase('/MetroRig/', '/kit/ride.wav')).toBe('/MetroRig/kit/ride.wav');
    expect(withBase('/MetroRig', '/kit/ride.wav')).toBe('/MetroRig/kit/ride.wav');
    expect(withBase('/', '/kit/ride.wav')).toBe('/kit/ride.wav');
    expect(withBase('/', '/pkg/metrorig_audio_bg.wasm')).toBe('/pkg/metrorig_audio_bg.wasm');
    expect(withBase('/MetroRig/', '/pads/choir/C3.flac')).toBe('/MetroRig/pads/choir/C3.flac');
  });

  it('names the engine from the site root', () => {
    // scripts/copy_wasm.js writes the engine to public/pkg/, which the site serves from its root
    expect(ENGINE_WASM).toBe('/pkg/metrorig_audio_bg.wasm');
  });
});

const ROOT = path.resolve(__dirname, '..');

function sourceFiles(dir: string): string[] {
  return fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true }).flatMap(entry => {
    const name = path.join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(name);
    return /\.ts$/.test(entry.name) ? [name] : [];
  });
}

// A path from the site root to a sound or to the engine, written as a string
const ROOT_ASSET = /['"`]\/[\w./${}-]*\.(wav|flac|mp3|ogg|wasm)['"`]/;

describe('asset paths', () => {
  it('only the Session resolves asset paths', () => {
    // The screens, the audio adapter and the composition root hand the Session data paths; they never fetch one
    const files = ['src/main.ts', ...sourceFiles('src/ui'), ...sourceFiles('src/audio')];
    const offenders = files.filter(file => ROOT_ASSET.test(fs.readFileSync(path.join(ROOT, file), 'utf8')));
    expect(offenders).toEqual([]);
    expect(files).toContain('src/audio/MetronomeNode.ts');
  });

  it('the composition root hands the Session the base Vite serves from', () => {
    const main = fs.readFileSync(path.join(ROOT, 'src/main.ts'), 'utf8');
    expect(main).toMatch(/assetBase:\s*import\.meta\.env\.BASE_URL/);
  });
});
