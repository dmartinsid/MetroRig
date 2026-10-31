import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

describe('Shipped WASM', () => {
  it('swing_05 exports no swing function', () => {
    const wasm = fs.readFileSync(path.resolve(__dirname, '../public/pkg/metrorig_audio_bg.wasm'));
    const exports = WebAssembly.Module.exports(new WebAssembly.Module(wasm)).map(entry => entry.name);

    expect(exports).toContain('engine_set_trainer');
    expect(exports).not.toContain('engine_set_swing');
  });
});
