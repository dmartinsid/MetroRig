import { describe, it, expect, vi } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { MetronomeNode } from './audio/MetronomeNode';

const mockInit = vi.fn().mockResolvedValue(undefined);
const mockLoadSample = vi.fn().mockResolvedValue(undefined);
const mockSetClickMode = vi.fn();

vi.mock('./audio/MetronomeNode', () => {
  return {
    MetronomeNode: class MockMetronomeNode extends EventTarget {
      init = mockInit;
      resumeContext = vi.fn().mockResolvedValue(undefined);
      start = vi.fn();
      stop = vi.fn();
      setBpm = vi.fn();
      setSwing = vi.fn();
      setMeasureLength = vi.fn();
      updateGrid = vi.fn();
      setTrainer = vi.fn();
      loadSample = mockLoadSample;
      setClickMode = mockSetClickMode;
    }
  };
});

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

const mockGsap = {
  killTweensOf: vi.fn(),
  set: vi.fn(),
  to: vi.fn(),
  fromTo: vi.fn(),
};
vi.stubGlobal('gsap', mockGsap);

describe('Integration Test', () => {
  it('should load main.ts without throwing and sanitize/validate time signature', async () => {
    const htmlPath = path.resolve(__dirname, '../index.html');
    let html = fs.readFileSync(htmlPath, 'utf8');
    // Strip stylesheet links to avoid happy-dom fetch errors
    html = html.replace(/<link[^>]*stylesheet[^>]*>/g, '');
    document.documentElement.innerHTML = html;

    // Spy on global alert
    const alertSpy = vi.fn();
    vi.stubGlobal('alert', alertSpy);

    // This will trigger main.ts execution
    await import('./main');

    const timeSigNum = document.getElementById('time-sig-num') as HTMLInputElement;
    const timeSigDen = document.getElementById('time-sig-den') as HTMLSelectElement;

    // 1. Numerator Input Sanitization
    timeSigDen.value = '16'; // Set denominator to 16 so that 16 steps does not exceed 32 max steps
    timeSigNum.value = '20'; // > 16 limit
    timeSigNum.onchange?.(new Event('change'));
    expect(timeSigNum.value).toBe('16');

    timeSigNum.value = '0'; // < 1 limit
    timeSigNum.onchange?.(new Event('change'));
    expect(timeSigNum.value).toBe('1');

    timeSigNum.value = 'abc'; // non-numeric
    timeSigNum.onchange?.(new Event('change'));
    expect(timeSigNum.value).toBe('1');

    // 2. Revert UI on Max Step Validation Failure (measureLength > 32 steps)
    // Setup valid 4/4 first
    timeSigNum.value = '4';
    timeSigDen.value = '4';
    timeSigNum.onchange?.(new Event('change'));

    // Trigger invalid transition (10/4, which translates to 40 steps, > 32 max)
    timeSigNum.value = '10';
    timeSigDen.value = '4';
    timeSigNum.onchange?.(new Event('change'));

    expect(alertSpy).toHaveBeenCalledWith('Time signature exceeds the maximum limit of 32 steps!');
    // Reverted back to 4/4
    expect(timeSigNum.value).toBe('4');
    expect(timeSigDen.value).toBe('4');
  });

  it('should handle click sound variation selector changes, race conditions and fetch rejections', async () => {
    vi.resetModules();
    const htmlPath = path.resolve(__dirname, '../index.html');
    let html = fs.readFileSync(htmlPath, 'utf8');
    html = html.replace(/<link[^>]*stylesheet[^>]*>/g, '');
    document.documentElement.innerHTML = html;

    mockSetClickMode.mockClear();
    
    // Custom mock for loadSample to control its resolution/rejection time
    let resolveLoadPromise: (() => void)[] = [];
    let rejectLoadPromise: ((err: Error) => void)[] = [];
    mockLoadSample.mockImplementation((sampleId: number) => {
      if (sampleId === 0) {
        return new Promise<void>((resolve, reject) => {
          resolveLoadPromise.push(resolve);
          rejectLoadPromise.push(reject);
        });
      }
      return Promise.resolve();
    });
    mockLoadSample.mockClear();

    // Import main.ts
    await import('./main');

    const clickSoundSelector = document.getElementById('click-sound-selector') as HTMLSelectElement;
    const btnPlay = document.getElementById('btn-play') as HTMLButtonElement;

    // 1. Initial play initialization
    btnPlay.click();
    // Flush the click microtasks
    await new Promise(process.nextTick);

    // Initial syncClickSound gets called. Since initially it is 'digital', loadSample isn't called.
    expect(mockSetClickMode).toHaveBeenCalledWith(0);
    mockSetClickMode.mockClear();

    // 2. Select a WAV sound (e.g. woodblock)
    clickSoundSelector.value = 'woodblock';
    const onChangePromise1 = clickSoundSelector.onchange?.(new Event('change'));

    expect(mockLoadSample).toHaveBeenCalledWith(0, '/woodblock.wav');
    expect(resolveLoadPromise.length).toBe(1);

    // Resolve the promise
    resolveLoadPromise[0]();
    await onChangePromise1;

    expect(mockSetClickMode).toHaveBeenCalledWith(1);
    mockSetClickMode.mockClear();
    mockLoadSample.mockClear();
    resolveLoadPromise = [];
    rejectLoadPromise = [];

    // 3. Test fetch rejection error handling
    clickSoundSelector.value = 'cowbell';
    const onChangePromise2 = clickSoundSelector.onchange?.(new Event('change'));

    expect(mockLoadSample).toHaveBeenCalledWith(0, '/cowbell.wav');
    expect(rejectLoadPromise.length).toBe(1);

    // Reject the promise
    rejectLoadPromise[0](new Error('Fetch failed'));
    await onChangePromise2;

    // Should log warning/error and fallback to digital (mode 0)
    expect(mockSetClickMode).toHaveBeenCalledWith(0);
    mockSetClickMode.mockClear();
    mockLoadSample.mockClear();
    resolveLoadPromise = [];
    rejectLoadPromise = [];

    // 4. Test race condition (woodblock starts loading, then user switches to stick)
    clickSoundSelector.value = 'woodblock';
    const onChangePromiseWoodblock = clickSoundSelector.onchange?.(new Event('change')); // loadId 1
    
    clickSoundSelector.value = 'stick';
    const onChangePromiseStick = clickSoundSelector.onchange?.(new Event('change')); // loadId 2

    // Now resolve woodblock load (loadId 1)
    resolveLoadPromise[0]();
    await onChangePromiseWoodblock;

    // Since loadId 1 is older than the active one (loadId 2), it should NOT set click mode to 1.
    expect(mockSetClickMode).not.toHaveBeenCalled();

    // Resolve stick load (loadId 2)
    resolveLoadPromise[1]();
    await onChangePromiseStick;

    // Since loadId 2 is the active one, it should set click mode to 1.
    expect(mockSetClickMode).toHaveBeenCalledWith(1);
    mockSetClickMode.mockClear();
    mockLoadSample.mockClear();
    resolveLoadPromise = [];
    rejectLoadPromise = [];

    // 5. Test race condition switching to digital: woodblock starts loading, user switches to digital.
    clickSoundSelector.value = 'woodblock';
    const onChangePromiseWoodblock2 = clickSoundSelector.onchange?.(new Event('change'));

    clickSoundSelector.value = 'digital';
    const onChangePromiseDigital = clickSoundSelector.onchange?.(new Event('change'));

    // Digital sets click mode 0 synchronously.
    expect(mockSetClickMode).toHaveBeenCalledWith(0);
    mockSetClickMode.mockClear();

    // Now resolve woodblock load
    resolveLoadPromise[0]();
    await onChangePromiseWoodblock2;

    // Since digital was selected, the woodblock load should be discarded and NOT set click mode to 1.
    expect(mockSetClickMode).not.toHaveBeenCalled();
  });
});

import { StateManager } from './state';

describe('StateManager IndexedDB Upgrade', () => {
  it('should initialize StateManager and allow saving custom grooves', async () => {
    const manager = new StateManager();
    expect(manager).toBeDefined();

    const testGroove = {
      id: 'test-groove',
      name: 'Test Groove',
      gridData: {
        1: [1, 0, 0, 0],
        2: [0, 0, 1, 0],
        3: [1, 1, 1, 1]
      },
      measureLength: 4
    };

    // Save groove (should resolve even if IDB fallback is active)
    await expect(manager.saveGroove(testGroove)).resolves.not.toThrow();

    // Get all grooves
    const grooves = await manager.getAllGrooves();
    expect(Array.isArray(grooves)).toBe(true);
  });
});
