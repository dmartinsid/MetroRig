import { describe, it, expect, vi } from 'vitest';
import { MetronomeNode } from '../src/audio/MetronomeNode';

// Mock Web Audio API
class MockAudioContext {
  state = 'suspended';
  sampleRate = 48000;
  audioWorklet = {
    addModule: vi.fn().mockResolvedValue(undefined),
  };
  destination = {};
  resume = vi.fn().mockResolvedValue(undefined);
  decodeAudioData = vi.fn();
}

class MockMessagePort {
  postMessage = vi.fn();
  start = vi.fn();
  onmessage = null;
}

class MockAudioWorkletNode {
  port = new MockMessagePort();
  connect = vi.fn();
  onprocessorerror = null;
}

vi.stubGlobal('AudioContext', MockAudioContext);
vi.stubGlobal('AudioWorkletNode', MockAudioWorkletNode);

describe('MetronomeNode', () => {
  it('tries again after the worklet reports a WASM error', async () => {
    const node = new MetronomeNode();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, arrayBuffer: async () => new ArrayBuffer(8) }));

    const settle = async (type: string) => {
      const init = node.init('/engine.wasm', '/worklet.js');
      await vi.waitFor(() => expect((node as any).workletNode?.port.onmessage).toBeTruthy());
      (node as any).workletNode.port.onmessage({ data: { type, error: 'bad module' } });
      return init;
    };

    await expect(settle('WASM_ERROR')).rejects.toThrow('bad module');
    (node as any).workletNode = null;
    await expect(settle('WASM_READY')).resolves.toBeUndefined();
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('reports the sample rate the context really runs at', () => {
    expect(new MetronomeNode().sampleRate()).toBe(48000);
  });

  it('loads a take as its channels times the trim', async () => {
    const node = new MetronomeNode();
    const mockWorkletNode = new MockAudioWorkletNode();
    (node as any).workletNode = mockWorkletNode;
    const left = new Float32Array([1, -0.5, 0.25]);
    const right = new Float32Array([0.5, 0.5, -1]);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ arrayBuffer: async () => new ArrayBuffer(0) }));
    (node as any).ctx.decodeAudioData.mockResolvedValue({
      numberOfChannels: 2,
      getChannelData: (channel: number) => (channel === 0 ? left : right),
    });

    await node.loadTake(12, 2, 1, '/kit/house/tom-14/hard-2.wav', 0.5);

    expect(fetch).toHaveBeenCalledWith('/kit/house/tom-14/hard-2.wav');
    const message = mockWorkletNode.port.postMessage.mock.calls.at(-1)![0];
    expect(message.type).toBe('LOAD_TAKE');
    expect([message.trackId, message.dynamic, message.take]).toEqual([12, 2, 1]);
    expect(Array.from(message.leftChannel)).toEqual([0.5, -0.25, 0.125]);
    expect(Array.from(message.rightChannel)).toEqual([0.25, 0.25, -0.5]);
    expect(Array.from(left)).toEqual([1, -0.5, 0.25]);
  });

  it('loads a mono take on both channels at its trim', async () => {
    const node = new MetronomeNode();
    const mockWorkletNode = new MockAudioWorkletNode();
    (node as any).workletNode = mockWorkletNode;
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ arrayBuffer: async () => new ArrayBuffer(0) }));
    (node as any).ctx.decodeAudioData.mockResolvedValue({
      numberOfChannels: 1,
      getChannelData: () => new Float32Array([1, 0.5]),
    });

    await node.loadTake(1, 0, 0, '/kit/house/kick/soft-1.wav', 0.5);

    const message = mockWorkletNode.port.postMessage.mock.calls.at(-1)![0];
    expect(Array.from(message.leftChannel)).toEqual([0.5, 0.25]);
    expect(Array.from(message.rightChannel)).toEqual([0.5, 0.25]);
  });

  it('should post message to worklet when restartPattern is called', () => {
    const node = new MetronomeNode();
    const mockWorkletNode = new MockAudioWorkletNode();
    (node as any).workletNode = mockWorkletNode;

    node.restartPattern();

    expect(mockWorkletNode.port.postMessage).toHaveBeenCalledWith({ type: 'RESTART_PATTERN' });
  });

  it('should post message to worklet when setBars is called', () => {
    const node = new MetronomeNode();
    const mockWorkletNode = new MockAudioWorkletNode();
    (node as any).workletNode = mockWorkletNode;

    node.setBars(4);

    expect(mockWorkletNode.port.postMessage).toHaveBeenCalledWith({ type: 'SET_BARS', bars: 4 });
  });

  it('should post message to worklet when setMeasureLength is called', () => {
    const node = new MetronomeNode();
    const mockWorkletNode = new MockAudioWorkletNode();
    (node as any).workletNode = mockWorkletNode;

    node.setMeasureLength(8);

    expect(mockWorkletNode.port.postMessage).toHaveBeenCalledWith({
      type: 'SET_MEASURE_LENGTH',
      length: 8,
    });
  });

  it('sends replacing and deferred Trainer settings as separate messages', () => {
    const node = new MetronomeNode();
    const mockWorkletNode = new MockAudioWorkletNode();
    (node as any).workletNode = mockWorkletNode;
    const settings = { enabled: true, startBpm: 100, targetBpm: 160, increment: 5, stepType: 'measures' as const, stepValue: 1, curve: 'stepped' as const };

    node.replaceTrainer(settings);
    expect(mockWorkletNode.port.postMessage).toHaveBeenLastCalledWith({ type: 'REPLACE_TRAINER', ...settings });

    node.setTrainer(settings);
    expect(mockWorkletNode.port.postMessage).toHaveBeenLastCalledWith({ type: 'SET_TRAINER', ...settings });
  });

  it('should post message to worklet when setClickMode is called', () => {
    const node = new MetronomeNode();
    const mockWorkletNode = new MockAudioWorkletNode();
    (node as any).workletNode = mockWorkletNode;

    node.setClickMode(1);

    expect(mockWorkletNode.port.postMessage).toHaveBeenCalledWith({
      type: 'SET_CLICK_MODE',
      mode: 1,
    });
  });

  it('should write no log when messages arrive from the worklet', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      arrayBuffer: () => Promise.resolve(new ArrayBuffer(8)),
    }));
    const node = new MetronomeNode();
    const ready = node.init('engine.wasm', 'worklet.js');
    await vi.waitFor(() => expect((node as any).workletNode?.port.onmessage).toBeTruthy());
    const port = (node as any).workletNode.port;
    const ticks: unknown[] = [];
    node.addEventListener('tick', (event) => ticks.push((event as CustomEvent).detail));
    const log = vi.spyOn(console, 'log');

    const tick = { type: 'TICK', beatIndex: 4, currentBpm: 97, activeTrackIds: [0] };
    port.onmessage({ data: { type: 'WASM_READY' } });
    await ready;
    port.onmessage({ data: tick });

    expect(ticks).toEqual([tick]);
    expect(log).not.toHaveBeenCalled();
    log.mockRestore();
    vi.unstubAllGlobals();
    vi.stubGlobal('AudioContext', MockAudioContext);
    vi.stubGlobal('AudioWorkletNode', MockAudioWorkletNode);
  });

  it('should have no swing setting to send', () => {
    const node = new MetronomeNode();
    const mockWorkletNode = new MockAudioWorkletNode();
    (node as any).workletNode = mockWorkletNode;

    node.start();
    node.setBpm(120);
    node.setMeasureLength(16);
    node.stop();

    const types = mockWorkletNode.port.postMessage.mock.calls.map(([msg]) => msg.type);
    expect(types).toEqual(['START', 'SET_BPM', 'SET_MEASURE_LENGTH', 'STOP']);
    expect('setSwing' in node).toBe(false);
  });

  it('should derive the visual delay from the context latencies', () => {
    const node = new MetronomeNode();
    (node as any).ctx.baseLatency = 0.05;
    (node as any).ctx.outputLatency = 0.15;
    expect(node.visualDelayMs()).toBeCloseTo(200);

    (node as any).ctx.outputLatency = undefined;
    expect(node.visualDelayMs()).toBeCloseTo(50);

    (node as any).ctx.baseLatency = undefined;
    expect(node.visualDelayMs()).toBe(0);
  });

  function padNode(sampleRate = 48000) {
    const node = new MetronomeNode();
    const worklet = new MockAudioWorkletNode();
    (node as any).workletNode = worklet;
    (node as any).ctx.sampleRate = sampleRate;
    return { node, port: worklet.port, decodeAudioData: (node as any).ctx.decodeAudioData };
  }

  const okFile = { ok: true, status: 200, arrayBuffer: async () => new ArrayBuffer(8) };

  it('pad_23 posts the notes of a chord to the worklet', () => {
    const { node, port } = padNode();

    node.padPlay([48, 52, 55, 59, 62], 1);

    expect(port.postMessage).toHaveBeenCalledOnce();
    expect(port.postMessage).toHaveBeenCalledWith({ type: 'PAD_PLAY', notes: [48, 52, 55, 59, 62], timbre: 1 });
  });

  it('tim_15 posts a chord of 7 notes in its timbre to the worklet', () => {
    const { node, port } = padNode();

    node.padPlay([21, 33, 45, 49, 52, 56, 59], 2);

    expect(port.postMessage).toHaveBeenCalledOnce();
    expect(port.postMessage).toHaveBeenCalledWith({ type: 'PAD_PLAY', notes: [21, 33, 45, 49, 52, 56, 59], timbre: 2 });
  });

  it('tim_15 posts the timbre of a file to the worklet', async () => {
    const { node, port, decodeAudioData } = padNode(44100);
    const left = new Float32Array([0.5, -0.5]);
    const right = new Float32Array([0.25, -0.25]);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(okFile));
    decodeAudioData.mockResolvedValue({
      numberOfChannels: 2,
      getChannelData: (channel: number) => (channel === 0 ? left : right),
    });

    await node.padLoad(2, 59, '/pads/orchestra/B3.flac', 0, 176400);

    expect(fetch).toHaveBeenCalledWith('/pads/orchestra/B3.flac');
    expect(port.postMessage).toHaveBeenCalledOnce();
    expect(port.postMessage).toHaveBeenCalledWith({
      type: 'PAD_LOAD',
      timbre: 2,
      key: 59,
      loopStart: 0,
      loopEnd: 176400,
      leftChannel: left,
      rightChannel: right,
    });
  });

  it('tim_30 posts the bracket of a load to the worklet', () => {
    const { node, port } = padNode();

    node.padLoadBegin(1);
    node.padLoadEnd(1);

    expect(port.postMessage.mock.calls).toEqual([[{ type: 'PAD_LOAD_BEGIN', timbre: 1 }], [{ type: 'PAD_LOAD_END', timbre: 1 }]]);
  });

  it('pad_09 posts a stop to the worklet', () => {
    const { node, port } = padNode();

    node.padStop();

    expect(port.postMessage).toHaveBeenCalledOnce();
    expect(port.postMessage).toHaveBeenCalledWith({ type: 'PAD_STOP' });
  });

  it('pad_42 posts the volume to the worklet', () => {
    const { node, port } = padNode();

    node.padVolume(0.3);

    expect(port.postMessage).toHaveBeenCalledOnce();
    expect(port.postMessage).toHaveBeenCalledWith({ type: 'PAD_VOLUME', volume: 0.3 });
  });

  it('pad_58 scales the loop points to the rate of the context', async () => {
    const { node, port, decodeAudioData } = padNode(48000);
    const left = new Float32Array([0.5, -0.5]);
    const right = new Float32Array([0.25, -0.25]);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(okFile));
    decodeAudioData.mockResolvedValue({
      numberOfChannels: 2,
      getChannelData: (channel: number) => (channel === 0 ? left : right),
    });

    await node.padLoad(1, 56, '/pads/new-age/Gs3.flac', 44100, 100001);

    expect(fetch).toHaveBeenCalledWith('/pads/new-age/Gs3.flac');
    expect(port.postMessage).toHaveBeenCalledOnce();
    const message = port.postMessage.mock.calls[0][0];
    expect(message.type).toBe('PAD_LOAD');
    expect(message.timbre).toBe(1);
    expect(message.key).toBe(56);
    expect(message.loopStart).toBe(48000);
    expect(message.loopEnd).toBe(108845); // 108844.63, to the nearest frame: the engine takes whole frames
    expect(Array.from(message.leftChannel)).toEqual([0.5, -0.5]);
    expect(Array.from(message.rightChannel)).toEqual([0.25, -0.25]);
  });

  it('pad_58 keeps the loop points at 44.1 kHz', async () => {
    const { node, port, decodeAudioData } = padNode(44100);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(okFile));
    decodeAudioData.mockResolvedValue({ numberOfChannels: 1, getChannelData: () => new Float32Array([1, 0.5]) });

    await node.padLoad(1, 48, '/pads/new-age/C3.flac', 1234, 56789);

    const message = port.postMessage.mock.calls[0][0];
    expect([message.loopStart, message.loopEnd]).toEqual([1234, 56789]);
    expect(Array.from(message.leftChannel)).toEqual([1, 0.5]);
    expect(Array.from(message.rightChannel)).toEqual([1, 0.5]);
  });

  it('pad_50 rejects when the fetch fails, and sends nothing', async () => {
    const { node, port } = padNode();
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));

    await expect(node.padLoad(1, 48, '/pads/new-age/C3.flac', 0, 100)).rejects.toThrow('offline');

    expect(port.postMessage).not.toHaveBeenCalled();
  });

  it('pad_50 rejects a response that is not ok, naming its path', async () => {
    const { node, port, decodeAudioData } = padNode();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 404, arrayBuffer: async () => new ArrayBuffer(8) }));
    decodeAudioData.mockResolvedValue({ numberOfChannels: 1, getChannelData: () => new Float32Array(2) });

    await expect(node.padLoad(1, 48, '/pads/new-age/C3.flac', 0, 100)).rejects.toThrow('/pads/new-age/C3.flac');

    expect(decodeAudioData).not.toHaveBeenCalled();
    expect(port.postMessage).not.toHaveBeenCalled();
  });

  it('pad_50 rejects a file that does not decode', async () => {
    const { node, port, decodeAudioData } = padNode();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(okFile));
    decodeAudioData.mockRejectedValue(new Error('bad audio'));

    await expect(node.padLoad(1, 48, '/pads/new-age/C3.flac', 0, 100)).rejects.toThrow('bad audio');

    expect(port.postMessage).not.toHaveBeenCalled();
  });

  it('pad_29 leaves the drums reading a response that is not ok', async () => {
    const { node, port, decodeAudioData } = padNode();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 404, arrayBuffer: async () => new ArrayBuffer(8) }));
    decodeAudioData.mockResolvedValue({ numberOfChannels: 1, getChannelData: () => new Float32Array([0.5]) });

    await node.loadSample(1, '/kit/house/kick.wav');

    expect(port.postMessage.mock.calls[0][0].type).toBe('LOAD_SAMPLE');
  });
});
