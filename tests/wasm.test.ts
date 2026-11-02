import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

describe('Shipped WASM', () => {
  it('swing_05 exports no swing function', () => {
    const wasm = fs.readFileSync(path.resolve(__dirname, '../public/pkg/metrorig_audio_bg.wasm'));
    const exports = WebAssembly.Module.exports(new WebAssembly.Module(wasm)).map(entry => entry.name);

    expect(exports).toContain('engine_set_trainer');
    expect(exports).toContain('engine_restart_pattern');
    expect(exports).toContain('engine_load_take');
    expect(exports).not.toContain('engine_set_swing');
  });

  it('plays a step of the fourth bar', () => {
    const wasm = fs.readFileSync(path.resolve(__dirname, '../public/pkg/metrorig_audio_bg.wasm'));
    const engine = new WebAssembly.Instance(new WebAssembly.Module(wasm)).exports as any;
    const ptr = engine.engine_new(44100);

    const gridPtr = engine.engine_alloc(64);
    new Uint8Array(engine.memory.buffer, gridPtr, 64).fill(1);
    engine.engine_update_grid(ptr, 0, gridPtr, 64);
    engine.engine_set_bars(ptr, 4);

    const size = 128;
    const left = engine.engine_alloc(size * 4);
    const right = engine.engine_alloc(size * 4);
    const bpmPtr = engine.engine_alloc(8);
    engine.engine_start(ptr);
    let lastTick = -1;
    for (let block = 0; block < 3000; block++) {
      engine.engine_process(ptr, left, right, size);
      lastTick = Math.max(lastTick, engine.engine_get_tick(ptr, bpmPtr));
    }
    expect(lastTick).toBe(63);
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

  it('plays a take on track 12', () => {
    const wasm = fs.readFileSync(path.resolve(__dirname, '../public/pkg/metrorig_audio_bg.wasm'));
    const engine = new WebAssembly.Instance(new WebAssembly.Module(wasm)).exports as any;
    const ptr = engine.engine_new(44100);

    const samplePtr = engine.engine_alloc(4);
    const sample = new Float32Array(engine.memory.buffer, samplePtr, 1);
    [0.25, 0.5, 0.75].forEach((level, dynamic) => {
      sample[0] = level;
      engine.engine_load_take(ptr, 12, dynamic, 0, samplePtr, samplePtr, 1);
    });

    const gridPtr = engine.engine_alloc(32);
    new Uint8Array(engine.memory.buffer, gridPtr, 32)[0] = 3; // A ghost
    engine.engine_update_grid(ptr, 12, gridPtr, 32);

    const left = engine.engine_alloc(16);
    const right = engine.engine_alloc(16);
    engine.engine_start(ptr);
    engine.engine_process(ptr, left, right, 4);
    expect(new Float32Array(engine.memory.buffer, left, 4)[0]).toBe(0.25);
  });

  // Timbre ids, as PAD_TIMBRES orders them
  const NEW_AGE = 1;
  const ORCHESTRA = 2;
  const SWEEP = 3;
  const ANALOG = 4;

  // The loudest sample of each channel over some blocks, as the worklet renders them
  function padRenderer() {
    const wasm = fs.readFileSync(path.resolve(__dirname, '../public/pkg/metrorig_audio_bg.wasm'));
    const engine = new WebAssembly.Instance(new WebAssembly.Module(wasm)).exports as any;
    const ptr = engine.engine_new(44100);
    const size = 128;
    const left = engine.engine_alloc(size * 4);
    const right = engine.engine_alloc(size * 4);

    const render = (seconds: number) => {
      const peaks = [0, 0];
      for (let block = 0; block < seconds * 44100 / size; block++) {
        engine.engine_process(ptr, left, right, size);
        [left, right].forEach((channel, index) => {
          for (const sample of new Float32Array(engine.memory.buffer, channel, size)) {
            peaks[index] = Math.max(peaks[index], Math.abs(sample));
          }
        });
      }
      return peaks;
    };
    return { engine, ptr, render };
  }

  it('pad_23 renders while stopped', () => {
    const { engine, ptr, render } = padRenderer();
    expect(render(0.1)).toEqual([0, 0]);

    engine.engine_pad_play(ptr, 48, 52, 55, 59, 62, 0, 0, 5, NEW_AGE);
    render(2);

    const [left, right] = render(1);
    expect(left).toBeGreaterThan(0.003);
    expect(right).toBeGreaterThan(0.003);
    expect(left).toBeLessThanOrEqual(1);
    expect(right).toBeLessThanOrEqual(1);
  });

  it('pad_42 follows the shipped volume, and stop fades to silence', () => {
    const { engine, ptr, render } = padRenderer();
    engine.engine_pad_play(ptr, 48, 52, 55, 0, 0, 0, 0, 3, NEW_AGE);
    render(2);

    engine.engine_pad_set_volume(ptr, 0);
    render(0.1);
    expect(render(0.1)).toEqual([0, 0]);

    engine.engine_pad_set_volume(ptr, 1);
    render(0.1);
    expect(render(0.5)[0]).toBeGreaterThan(0.003);

    engine.engine_pad_stop(ptr);
    render(30);
    expect(render(0.1)).toEqual([0, 0]);
  });

  it('pad_17 layers a sample through the shipped load', () => {
    const synthAlone = padRenderer();
    synthAlone.engine.engine_pad_play(synthAlone.ptr, 48, 52, 55, 0, 0, 0, 0, 3, NEW_AGE);
    synthAlone.render(2);
    const [synthPeak] = synthAlone.render(1);

    const { engine, ptr, render } = padRenderer();
    const frames = 4000;
    const samplePtr = engine.engine_alloc(frames * 4);
    new Float32Array(engine.memory.buffer, samplePtr, frames).forEach((_, frame, sample) => {
      sample[frame] = frame % 40 < 20 ? 0.5 : -0.5;
    });
    engine.engine_pad_load(ptr, NEW_AGE, 48, 0, frames - 1, samplePtr, samplePtr, frames);
    engine.engine_pad_play(ptr, 48, 52, 55, 0, 0, 0, 0, 3, NEW_AGE);
    render(2);

    expect(render(1)[0]).toBeGreaterThan(synthPeak * 1.5);
  });

  describe('Timbres', () => {
    const frames = 4000;

    // A renderer with one file of the given height, in the given timbre
    function withFile(timbre: number, height: number) {
      const renderer = padRenderer();
      const { engine, ptr } = renderer;
      const samplePtr = engine.engine_alloc(frames * 4);
      new Float32Array(engine.memory.buffer, samplePtr, frames).forEach((_, frame, sample) => {
        sample[frame] = frame % 40 < 20 ? height : -height;
      });
      engine.engine_pad_load(ptr, timbre, 48, 0, frames - 1, samplePtr, samplePtr, frames);
      return renderer;
    }

    const heldPeak = ({ engine, ptr, render }: ReturnType<typeof padRenderer>, timbre: number) => {
      engine.engine_pad_play(ptr, 24, 36, 48, 52, 55, 59, 62, 7, timbre);
      render(2);
      return render(1)[0];
    };

    it('a file sounds only in its own timbre', () => {
      const elsewhere = heldPeak(withFile(SWEEP, 0.5), NEW_AGE);
      const synthAlone = heldPeak(padRenderer(), NEW_AGE);
      expect(elsewhere).toBe(synthAlone);
      expect(heldPeak(withFile(SWEEP, 0.5), SWEEP)).toBeGreaterThan(synthAlone * 1.5);
    });

    it('Orchestra sounds its files with no synth, and a synth with none', () => {
      expect(heldPeak(withFile(ORCHESTRA, 0), ORCHESTRA)).toBe(0);
      expect(heldPeak(padRenderer(), ORCHESTRA)).toBeGreaterThan(0.003);
    });

    it('Analog takes no file', () => {
      expect(heldPeak(withFile(ANALOG, 0.5), ANALOG)).toBe(heldPeak(padRenderer(), ANALOG));
    });
  });
});
