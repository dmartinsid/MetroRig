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

  it('kit_02 plays the last track of the kit', () => {
    const wasm = fs.readFileSync(path.resolve(__dirname, '../public/pkg/metrorig_audio_bg.wasm'));
    const engine = new WebAssembly.Instance(new WebAssembly.Module(wasm)).exports as any;
    const ptr = engine.engine_new(44100);

    const samplePtr = engine.engine_alloc(4);
    new Float32Array(engine.memory.buffer, samplePtr, 1)[0] = 1;
    engine.engine_load_sample(ptr, 10, samplePtr, samplePtr, 1);

    const gridPtr = engine.engine_alloc(32);
    new Uint8Array(engine.memory.buffer, gridPtr, 32)[0] = 2;
    engine.engine_update_grid(ptr, 10, gridPtr, 32);

    const left = engine.engine_alloc(16);
    const right = engine.engine_alloc(16);
    engine.engine_start(ptr);
    engine.engine_process(ptr, left, right, 4);
    expect(new Float32Array(engine.memory.buffer, left, 4)[0]).toBeCloseTo(0.9);
  });
});
