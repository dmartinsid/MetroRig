import { describe, it, expect, vi } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

// Mock Web Audio API for test environment
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

describe('Integration Test', () => {
  it('should load main.ts without throwing', async () => {
    const htmlPath = path.resolve(__dirname, '../index.html');
    let html = fs.readFileSync(htmlPath, 'utf8');
    // Strip stylesheet links to avoid happy-dom fetch errors
    html = html.replace(/<link[^>]*stylesheet[^>]*>/g, '');
    document.documentElement.innerHTML = html;

    // This will trigger main.ts execution
    await import('./main');
  });
});
