import { describe, it, expect, vi } from 'vitest';
import { MetronomeNode } from '../src/audio/MetronomeNode';

// Mock Web Audio API
class MockAudioContext {
  state = 'suspended';
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
});
