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
    exports: {
      memory,
      engine_new: () => 1,
      engine_alloc: (size: number) => {
        const ptr = nextPtr;
        nextPtr += size + (8 - (size % 8)) % 8;
        return ptr;
      },
      engine_start: vi.fn(),
      engine_set_bpm: vi.fn(),
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
        return 0;
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
});
