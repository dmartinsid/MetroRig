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
  it('reports the sample rate the context really runs at', () => {
    expect(new MetronomeNode().sampleRate()).toBe(48000);
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
});
