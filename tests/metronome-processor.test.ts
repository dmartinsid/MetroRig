import { describe, it, expect, vi, beforeAll, beforeEach, afterEach, afterAll } from 'vitest';

const RealFloat32Array = Float32Array;
const RealFloat64Array = Float64Array;
const BLOCK = 128;

class FakeWorkletProcessor {
  port = { postMessage: vi.fn(), start: vi.fn(), onmessage: null as ((event: { data: unknown }) => void) | null };
}

let Processor: new () => FakeWorkletProcessor & { process(inputs: unknown[], outputs: Float32Array[][], parameters: object): boolean };

// Stands in for the Rust engine: each block fills both channels with its block number
function fakeEngine() {
  const memory = new WebAssembly.Memory({ initial: 2, maximum: 4 });
  let nextPtr = 1024;
  const engine = {
    block: 0,
    growDuringNextBlock: false,
    tickOnBlocks: new Set<number>(),
    tickStep: 0,
    exports: {
      memory,
      engine_new: () => 1,
      engine_alloc: (size: number) => {
        const ptr = nextPtr;
        nextPtr += size + (8 - (size % 8)) % 8;
        return ptr;
      },
      engine_free_buf: vi.fn(),
      engine_update_grid: vi.fn(),
      engine_load_take: vi.fn(),
      engine_start: vi.fn(),
      engine_set_bpm: vi.fn(),
      engine_set_bars: vi.fn(),
      engine_restart_pattern: vi.fn(),
      engine_set_trainer: vi.fn(),
      engine_replace_trainer: vi.fn(),
      engine_process: (_ptr: number, outL: number, outR: number, length: number) => {
        engine.block++;
        if (engine.growDuringNextBlock) {
          engine.growDuringNextBlock = false;
          memory.grow(1);
        }
        const heap = new RealFloat32Array(memory.buffer);
        heap.fill(engine.block, outL / 4, outL / 4 + length);
        heap.fill(-engine.block, outR / 4, outR / 4 + length);
      },
      engine_get_tick: (_ptr: number, bpmPtr: number) => {
        if (!engine.tickOnBlocks.has(engine.block)) return -1;
        new RealFloat64Array(memory.buffer)[bpmPtr / 8] = 120;
        return engine.tickStep;
      },
    },
  };
  return engine;
}

async function startProcessor(engine: ReturnType<typeof fakeEngine>) {
  vi.spyOn(WebAssembly, 'instantiate').mockResolvedValue({ instance: { exports: engine.exports } } as never);
  const processor = new Processor();
  const send = (data: unknown) => processor.port.onmessage!({ data });
  send({ type: 'INIT_WASM', wasmBuffer: new ArrayBuffer(0) });
  await vi.waitFor(() => expect(processor.port.postMessage).toHaveBeenCalledWith({ type: 'WASM_READY' }));

  const output = [new RealFloat32Array(BLOCK), new RealFloat32Array(BLOCK)];
  const runBlock = () => processor.process([], [output], {});
  return { processor, send, output, runBlock };
}

// Counts every view the processor builds, including subarrays, which construct through the subclass
function countViews() {
  const counter = { views: 0 };
  vi.stubGlobal('Float32Array', class extends RealFloat32Array {
    constructor(...args: ConstructorParameters<typeof RealFloat32Array>) {
      super(...args);
      counter.views++;
    }
  });
  vi.stubGlobal('Float64Array', class extends RealFloat64Array {
    constructor(...args: ConstructorParameters<typeof RealFloat64Array>) {
      super(...args);
      counter.views++;
    }
  });
  return counter;
}

describe('Worklet', () => {
  beforeAll(async () => {
    vi.stubGlobal('AudioWorkletProcessor', FakeWorkletProcessor);
    vi.stubGlobal('sampleRate', 44100);
    vi.stubGlobal('registerProcessor', (_name: string, processor: typeof Processor) => {
      Processor = processor;
    });
    await import('../src/audio/metronome-processor');
  });

  beforeEach(() => {
    vi.stubGlobal('Float32Array', RealFloat32Array);
    vi.stubGlobal('Float64Array', RealFloat64Array);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.stubGlobal('Float32Array', RealFloat32Array);
    vi.stubGlobal('Float64Array', RealFloat64Array);
  });

  afterAll(() => {
    vi.unstubAllGlobals();
  });

  it('sends each Trainer message to its engine export', async () => {
    const engine = fakeEngine();
    const { send } = await startProcessor(engine);
    const settings = { enabled: true, startBpm: 100, targetBpm: 160, increment: 5, stepType: 'measures', stepValue: 1, curve: 'stepped' };

    send({ type: 'REPLACE_TRAINER', ...settings });
    expect(engine.exports.engine_replace_trainer).toHaveBeenCalledWith(1, 1, 100, 160, 5, 0, 1, 0);
    expect(engine.exports.engine_set_trainer).not.toHaveBeenCalled();

    send({ type: 'SET_TRAINER', ...settings });
    expect(engine.exports.engine_set_trainer).toHaveBeenCalledWith(1, 1, 100, 160, 5, 0, 1, 0);
    expect(engine.exports.engine_replace_trainer).toHaveBeenCalledOnce();
  });

  it('rt_01 no logs on messages or ticks', async () => {
    const logs = (['log', 'info', 'debug', 'warn'] as const).map(level => vi.spyOn(console, level));
    const engine = fakeEngine();
    engine.tickOnBlocks = new Set([1, 50, 100]);

    const early = new Processor();
    early.port.onmessage!({ data: { type: 'START' } });

    const { processor, send, runBlock } = await startProcessor(engine);
    send({ type: 'START' });
    send({ type: 'SET_BPM', bpm: 97 });
    for (let block = 0; block < 100; block++) runBlock();

    expect(engine.exports.engine_start).toHaveBeenCalledOnce();
    expect(engine.exports.engine_set_bpm).toHaveBeenCalledWith(1, 97);
    const ticks = processor.port.postMessage.mock.calls.filter(([msg]) => msg.type === 'TICK');
    expect(ticks).toHaveLength(3);
    expect(ticks[0][0]).toEqual({ type: 'TICK', beatIndex: 0, currentBpm: 120, activeTrackIds: [] });
    logs.forEach(log => expect(log).not.toHaveBeenCalled());
  });

  it('reports every track of the kit on a tick', async () => {
    const engine = fakeEngine();
    engine.tickOnBlocks = new Set([1]);
    const { processor, send, runBlock } = await startProcessor(engine);

    for (const trackId of [1, 8, 10]) {
      send({ type: 'UPDATE_GRID', trackId, steps: new Uint8Array([1, 0, 0, 0]) });
    }
    runBlock();

    const tick = processor.port.postMessage.mock.calls.find(([msg]) => msg.type === 'TICK')!;
    expect(tick[0].activeTrackIds).toEqual([1, 8, 10]);
    expect(engine.exports.engine_update_grid).toHaveBeenCalledWith(1, 10, expect.any(Number), 128);
  });

  it('reports tracks 11 and 12 on a tick', async () => {
    const engine = fakeEngine();
    engine.tickOnBlocks = new Set([1]);
    const { processor, send, runBlock } = await startProcessor(engine);

    for (const trackId of [11, 12]) {
      send({ type: 'UPDATE_GRID', trackId, steps: new Uint8Array([1, 0, 0, 0]) });
    }
    runBlock();

    const tick = processor.port.postMessage.mock.calls.find(([msg]) => msg.type === 'TICK')!;
    expect(tick[0].activeTrackIds).toEqual([11, 12]);
    expect(engine.exports.engine_update_grid).toHaveBeenCalledWith(1, 12, expect.any(Number), 128);
  });

  it('sends a LOAD_TAKE message to engine_load_take with its samples in the heap', async () => {
    const engine = fakeEngine();
    let heardLeft: number[] = [];
    let heardRight: number[] = [];
    engine.exports.engine_load_take.mockImplementation((_ptr: number, _track: number, _dynamic: number, _take: number, l: number, r: number, length: number) => {
      const heap = new RealFloat32Array(engine.exports.memory.buffer);
      heardLeft = Array.from(heap.subarray(l / 4, l / 4 + length));
      heardRight = Array.from(heap.subarray(r / 4, r / 4 + length));
    });
    const { send } = await startProcessor(engine);

    send({ type: 'LOAD_TAKE', trackId: 12, dynamic: 2, take: 1, leftChannel: new RealFloat32Array([0.5, 0.25]), rightChannel: new RealFloat32Array([-0.5, -0.25]) });

    expect(engine.exports.engine_load_take).toHaveBeenCalledWith(1, 12, 2, 1, expect.any(Number), expect.any(Number), 2);
    expect(heardLeft).toEqual([0.5, 0.25]);
    expect(heardRight).toEqual([-0.5, -0.25]);
    expect(engine.exports.engine_free_buf).toHaveBeenCalledTimes(2);
  });

  it('reports the tracks of a step past 32', async () => {
    const engine = fakeEngine();
    engine.tickOnBlocks = new Set([1]);
    engine.tickStep = 63;
    const { processor, send, runBlock } = await startProcessor(engine);

    const steps = new Uint8Array(64);
    steps[63] = 1;
    send({ type: 'UPDATE_GRID', trackId: 2, steps });
    runBlock();

    const tick = processor.port.postMessage.mock.calls.find(([msg]) => msg.type === 'TICK')!;
    expect(tick[0].beatIndex).toBe(63);
    expect(tick[0].activeTrackIds).toEqual([2]);
  });

  it('restarts the pattern in the engine', async () => {
    const engine = fakeEngine();
    const { send } = await startProcessor(engine);
    send({ type: 'RESTART_PATTERN' });
    expect(engine.exports.engine_restart_pattern).toHaveBeenCalledWith(1);
  });

  it('passes the bar count to the engine', async () => {
    const engine = fakeEngine();
    const { send } = await startProcessor(engine);
    send({ type: 'SET_BARS', bars: 4 });
    expect(engine.exports.engine_set_bars).toHaveBeenCalledWith(1, 4);
  });

  it('rt_02 reuses heap views', async () => {
    const engine = fakeEngine();
    engine.tickOnBlocks = new Set([2, 50, 100]);
    const { output, runBlock } = await startProcessor(engine);

    const counter = countViews();
    runBlock();
    runBlock();
    const viewsAfterFirstBlocks = counter.views;
    for (let block = 0; block < 98; block++) runBlock();

    expect(counter.views).toBe(viewsAfterFirstBlocks);
    expect(output[0]).toEqual(new RealFloat32Array(BLOCK).fill(100));
    expect(output[1]).toEqual(new RealFloat32Array(BLOCK).fill(-100));
  });

  it('rebuilds heap views when WASM memory grows', async () => {
    const engine = fakeEngine();
    engine.tickOnBlocks = new Set([2, 3]);
    const { processor, output, runBlock } = await startProcessor(engine);
    runBlock();

    engine.growDuringNextBlock = true;
    runBlock();

    expect(output[0]).toEqual(new RealFloat32Array(BLOCK).fill(2));
    expect(output[1]).toEqual(new RealFloat32Array(BLOCK).fill(-2));

    engine.exports.memory.grow(1);
    runBlock();

    expect(output[0]).toEqual(new RealFloat32Array(BLOCK).fill(3));
    expect(output[1]).toEqual(new RealFloat32Array(BLOCK).fill(-3));
    const ticks = processor.port.postMessage.mock.calls.filter(([msg]) => msg.type === 'TICK');
    expect(ticks.map(([msg]) => msg.currentBpm)).toEqual([120, 120]);
  });

  function padEngine() {
    const engine = fakeEngine();
    const pad = {
      engine_pad_play: vi.fn(),
      engine_pad_stop: vi.fn(),
      engine_pad_set_volume: vi.fn(),
      engine_pad_load: vi.fn(),
    };
    Object.assign(engine.exports, pad);
    return { engine, pad };
  }

  // What engine_pad_load finds in the heap at its pointers
  function hearLoad(engine: ReturnType<typeof fakeEngine>, pad: ReturnType<typeof padEngine>['pad']) {
    const heard = { left: [] as number[], right: [] as number[] };
    pad.engine_pad_load.mockImplementation((_ptr: number, _key: number, _start: number, _end: number, l: number, r: number, length: number) => {
      const heap = new RealFloat32Array(engine.exports.memory.buffer);
      heard.left = Array.from(heap.subarray(l / 4, l / 4 + length));
      heard.right = Array.from(heap.subarray(r / 4, r / 4 + length));
    });
    return heard;
  }

  it('pad_23 sends PAD_PLAY to the engine, filling the unused notes', async () => {
    const { engine, pad } = padEngine();
    const { send } = await startProcessor(engine);

    send({ type: 'PAD_PLAY', notes: [48, 52, 55] });
    expect(pad.engine_pad_play).toHaveBeenLastCalledWith(1, 48, 52, 55, 0, 0, 3);

    send({ type: 'PAD_PLAY', notes: [48, 52, 55, 58] });
    expect(pad.engine_pad_play).toHaveBeenLastCalledWith(1, 48, 52, 55, 58, 0, 4);

    send({ type: 'PAD_PLAY', notes: [48, 52, 55, 59, 62] });
    expect(pad.engine_pad_play).toHaveBeenLastCalledWith(1, 48, 52, 55, 59, 62, 5);
    expect(pad.engine_pad_play).toHaveBeenCalledTimes(3);
    expect(engine.exports.engine_start).not.toHaveBeenCalled();
  });

  it('pad_09 sends PAD_STOP to the engine', async () => {
    const { engine, pad } = padEngine();
    const { send } = await startProcessor(engine);

    send({ type: 'PAD_STOP' });

    expect(pad.engine_pad_stop).toHaveBeenCalledOnce();
    expect(pad.engine_pad_stop).toHaveBeenCalledWith(1);
  });

  it('pad_42 sends PAD_VOLUME to the engine', async () => {
    const { engine, pad } = padEngine();
    const { send } = await startProcessor(engine);

    send({ type: 'PAD_VOLUME', volume: 0.3 });

    expect(pad.engine_pad_set_volume).toHaveBeenCalledOnce();
    expect(pad.engine_pad_set_volume).toHaveBeenCalledWith(1, 0.3);
  });

  it('pad_17 sends PAD_LOAD to the engine with its samples in the heap', async () => {
    const { engine, pad } = padEngine();
    const heard = hearLoad(engine, pad);
    const { send } = await startProcessor(engine);

    send({ type: 'PAD_LOAD', key: 56, loopStart: 1, loopEnd: 2, leftChannel: new RealFloat32Array([0.5, 0.25, -0.25]), rightChannel: new RealFloat32Array([-0.5, -0.25, 0.25]) });

    expect(pad.engine_pad_load).toHaveBeenCalledWith(1, 56, 1, 2, expect.any(Number), expect.any(Number), 3);
    expect(heard.left).toEqual([0.5, 0.25, -0.25]);
    expect(heard.right).toEqual([-0.5, -0.25, 0.25]);
    expect(engine.exports.engine_free_buf).toHaveBeenCalledTimes(2);
  });

  it('pad_17 keeps rendering when a PAD_LOAD grows the WASM memory', async () => {
    const { engine, pad } = padEngine();
    const heard = hearLoad(engine, pad);
    const { send, output, runBlock } = await startProcessor(engine);
    runBlock();

    const alloc = engine.exports.engine_alloc;
    engine.exports.engine_alloc = (size: number) => {
      engine.exports.memory.grow(1);
      return alloc(size);
    };
    const frames = 20000; // Two channels of this fill more than the 2 pages the memory starts with
    const left = new RealFloat32Array(frames).fill(0.5);
    const right = new RealFloat32Array(frames).fill(-0.5);
    send({ type: 'PAD_LOAD', key: 48, loopStart: 0, loopEnd: frames - 1, leftChannel: left, rightChannel: right });

    expect(heard.left).toEqual(Array.from(left));
    expect(heard.right).toEqual(Array.from(right));

    runBlock();
    expect(output[0]).toEqual(new RealFloat32Array(BLOCK).fill(2));
    expect(output[1]).toEqual(new RealFloat32Array(BLOCK).fill(-2));
  });
});
