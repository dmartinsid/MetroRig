import { describe, it, expect, vi, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { MetronomeNode } from './audio/MetronomeNode';

const mockInit = vi.fn().mockResolvedValue(undefined);
const mockLoadSample = vi.fn().mockResolvedValue(undefined);
const mockSetClickMode = vi.fn();

// Every message the page sends the audio node, in order
const audioCalls: { method: string; args: any[] }[] = [];
const recorded = (method: string) => vi.fn((...args: any[]) => {
  audioCalls.push({ method, args });
});
let mockNode: any;
let mockVisualDelay = 0;

vi.mock('./audio/MetronomeNode', () => {
  return {
    MetronomeNode: class MockMetronomeNode extends EventTarget {
      init = mockInit;
      resumeContext = vi.fn().mockResolvedValue(undefined);
      start = recorded('start');
      stop = recorded('stop');
      setBpm = recorded('setBpm');
      setMeasureLength = recorded('setMeasureLength');
      updateGrid = recorded('updateGrid');
      setTrainer = recorded('setTrainer');
      loadSample = mockLoadSample;
      setClickMode = mockSetClickMode;
      visualDelayMs = () => mockVisualDelay;

      constructor() {
        super();
        mockNode = this;
      }
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

// In-memory stand-in for the browser database, so the real StateManager reads and writes it
function fakeIndexedDB(presets: any[]) {
  const stores: Record<string, Map<string, any>> = {
    presets: new Map(presets.map(preset => [preset.id, preset])),
    grooves: new Map(),
  };
  const request = (result?: any) => {
    const req: any = { result };
    queueMicrotask(() => req.onsuccess?.());
    return req;
  };
  const db = {
    transaction: () => ({
      objectStore: (name: string) => ({
        getAll: () => request([...stores[name].values()]),
        put: (record: any) => {
          stores[name].set(record.id, structuredClone(record));
          return request();
        },
      }),
    }),
  };
  (globalThis as any).indexedDB = { open: () => request(db) };
  return stores;
}

const flush = async () => {
  for (let i = 0; i < 20; i++) await new Promise(process.nextTick);
};

function storedPreset(overrides: Record<string, unknown> = {}) {
  return {
    id: 'stored',
    name: 'Stored',
    bpm: 100,
    timeSignature: '4/4',
    measureLength: 16,
    swing: 50,
    gridData: {
      0: [2, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0],
      1: [1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0],
      2: [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0],
      3: [1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0],
    },
    trainerSettings: { enabled: false, startBpm: 80, targetBpm: 160, increment: 5, stepType: 'measures', stepValue: 4, curve: 'stepped' },
    ...overrides,
  };
}

async function openPage(presets: any[] = []) {
  vi.resetModules();
  const html = fs.readFileSync(path.resolve(__dirname, '../index.html'), 'utf8');
  document.documentElement.innerHTML = html.replace(/<link[^>]*stylesheet[^>]*>/g, '');
  const stores = fakeIndexedDB(presets);
  audioCalls.length = 0;
  mockVisualDelay = 0;
  await import('./main');
  await flush();
  return stores;
}

const byId = <T extends HTMLElement = HTMLInputElement>(id: string) => document.getElementById(id) as unknown as T;

async function selectPreset(value: string) {
  const selector = byId<HTMLSelectElement>('preset-selector');
  selector.value = value;
  selector.dispatchEvent(new Event('change'));
  await flush();
}

const clickPlay = async () => {
  byId<HTMLButtonElement>('btn-play').click();
  await flush();
};

const calls = (method: string) => audioCalls.filter(call => call.method === method).map(call => call.args);
const lastCall = (method: string) => calls(method).at(-1) as any[];

const tick = (detail: { currentBpm: number; beatIndex?: number; activeTrackIds?: number[] }) => {
  mockNode.dispatchEvent(new CustomEvent('tick', { detail: { beatIndex: 0, activeTrackIds: [], ...detail } }));
};

function expectNoBeatRendered() {
  expect(byId('bpm-number').innerText).toBe('120');
  expect(byId('stadium-bpm').innerText).toBe('120.0');
  expect(byId('stadium-status').innerText).toBe('Trainer Off');
  expect(document.querySelector('.clock-label.active')).toBeNull();
  expect(mockGsap.fromTo).not.toHaveBeenCalled();
}

describe('Precise page', () => {
  afterEach(() => {
    vi.useRealTimers();
    delete (globalThis as any).indexedDB;
  });

  it('swing_04 save omits swing', async () => {
    const stores = await openPage([storedPreset()]);
    await selectPreset('user:stored');

    byId('preset-name').value = 'Saved again';
    byId<HTMLButtonElement>('btn-save').click();
    await flush();

    const saved = [...stores.presets.values()].find(preset => preset.name === 'Saved again');
    const { swing: _swing, id: _id, name: _name, ...expected } = storedPreset();
    expect(saved).toMatchObject(expected);
    expect(saved).not.toHaveProperty('swing');
    // Loading and saving a copy leaves the original record as it was
    expect(stores.presets.get('stored')).toEqual(storedPreset());
  });

  it('train_12 settings keep live bpm', async () => {
    await openPage();
    await clickPlay();
    audioCalls.length = 0;

    byId('time-sig-num').value = '3';
    byId('time-sig-num').dispatchEvent(new Event('change'));
    expect(lastCall('setMeasureLength')).toEqual([12]);

    document.querySelector<HTMLElement>('.step-cell[data-track="1"]')!.click();
    expect(lastCall('updateGrid')[0]).toBe(1);
    expect([...lastCall('updateGrid')[1]].slice(0, 2)).toEqual([1, 0]);

    const grooves = byId<HTMLSelectElement>('groove-selector');
    grooves.value = 'factory:metal';
    grooves.dispatchEvent(new Event('change'));
    expect(lastCall('updateGrid')[0]).toBe(3);
    expect([...lastCall('updateGrid')[1]]).toEqual(new Array(12).fill(1));

    const trainerEdits: [string, string, Record<string, unknown>][] = [
      ['trainer-start', '90', { startBpm: 90 }],
      ['trainer-target', '150', { targetBpm: 150 }],
      ['trainer-inc', '3', { increment: 3 }],
      ['trainer-val', '2', { stepValue: 2 }],
      ['trainer-type', 'seconds', { stepType: 'seconds' }],
      ['trainer-curve', 'smooth', { curve: 'smooth' }],
    ];
    trainerEdits.forEach(([id, value, sent]) => {
      byId(id).value = value;
      byId(id).dispatchEvent(new Event('change'));
      expect(lastCall('setTrainer')[0]).toMatchObject(sent);
    });
    byId('trainer-enable').checked = true;
    byId('trainer-enable').dispatchEvent(new Event('change'));
    expect(lastCall('setTrainer')[0]).toMatchObject({ enabled: true });

    expect(calls('setBpm')).toEqual([]);
  });

  it('swing_03 stored swing sends nothing', async () => {
    await openPage([storedPreset()]);
    await clickPlay();
    audioCalls.length = 0;

    await selectPreset('user:stored');

    expect(lastCall('setBpm')).toEqual([100]);
    expect(lastCall('setMeasureLength')).toEqual([16]);
    expect(JSON.stringify(audioCalls)).not.toMatch(/swing/i);
  });

  it('legacy 12/8 preset loads expanded', async () => {
    const legacy = storedPreset({
      bpm: 100,
      timeSignature: '12/8',
      measureLength: 12,
      gridData: { 0: [2, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0], 1: [], 2: [], 3: [] },
    });
    const stores = await openPage([legacy]);
    await clickPlay();
    audioCalls.length = 0;

    await selectPreset('user:stored');

    expect(byId('bpm-slider').value).toBe('150');
    expect(byId('bpm-number').innerText).toBe('150');
    expect(byId('panel-header-text').textContent).toContain('12/8  ·  150 BPM');
    expect(byId('stadium-bpm').innerText).toBe('150.0');
    expect(byId('time-sig-num').value).toBe('12');
    expect(byId('time-sig-den').value).toBe('8');

    const clickCells = [...document.querySelectorAll<HTMLElement>('.step-cell[data-track="0"]')];
    expect(clickCells).toHaveLength(24);
    const hitSteps = clickCells.flatMap((cell, step) =>
      cell.classList.contains('active') || cell.classList.contains('accent') ? [step] : []);
    expect(hitSteps).toEqual([0, 6, 12, 18]);

    expect(lastCall('setBpm')).toEqual([150]);
    expect(lastCall('setMeasureLength')).toEqual([24]);
    // Loading converts in memory; the stored record changes only on save
    expect(stores.presets.get('stored')).toEqual(legacy);
  });

  it('train_17 preset load replaces trainer immediately', async () => {
    const trainerOn = storedPreset();
    (trainerOn.trainerSettings as any).enabled = true;
    await openPage([trainerOn]);
    await clickPlay();
    audioCalls.length = 0;

    await selectPreset('user:stored');
    expect(lastCall('setTrainer')[1]).toBe(true);

    const increment = document.getElementById('trainer-inc') as HTMLInputElement;
    increment.value = '9';
    increment.onchange?.(new Event('change'));
    expect(lastCall('setTrainer')[0]).toMatchObject({ increment: 9 });
    expect(lastCall('setTrainer')[1]).toBe(false);
  });

  it('preset start bpm applies on load and play', async () => {
    const trainerOn = storedPreset();
    (trainerOn.trainerSettings as any).enabled = true;
    await openPage([trainerOn]);
    await clickPlay();
    audioCalls.length = 0;

    await selectPreset('user:stored');
    expect(lastCall('setBpm')).toEqual([80]);

    await selectPreset('factory:metal');
    expect(lastCall('setBpm')).toEqual([140]);

    await selectPreset('user:stored');
    await clickPlay(); // Stop
    audioCalls.length = 0;
    await clickPlay();

    const order = audioCalls.map(call => call.method);
    expect(order.indexOf('setBpm')).toBeLessThan(order.indexOf('start'));
    expect(lastCall('setBpm')).toEqual([80]);
    expect(byId('bpm-number').innerText).toBe('100');
  });

  it('train_10 slider sends bpm immediately', async () => {
    await openPage();
    byId('trainer-enable').checked = true;
    byId('trainer-enable').dispatchEvent(new Event('change'));
    await clickPlay();
    audioCalls.length = 0;

    byId('bpm-slider').value = '150';
    byId('bpm-slider').dispatchEvent(new Event('input'));

    expect(calls('setBpm')).toEqual([[150]]);
    expect(byId('bpm-number').innerText).toBe('150');
  });

  it('train_13 editor shows live bpm', async () => {
    await openPage();
    await clickPlay();

    tick({ currentBpm: 125 });
    expect(byId('bpm-number').innerText).toBe('125');

    tick({ currentBpm: 127.34 });
    expect(byId('bpm-number').innerText).toBe('127.3');

    byId('trainer-enable').checked = true;
    byId('trainer-enable').dispatchEvent(new Event('change'));
    tick({ currentBpm: 130 });
    expect(byId('bpm-number').innerText).toBe('130');
  });

  it('train_14 stop shows preset bpm', async () => {
    await openPage([storedPreset()]);
    await selectPreset('user:stored');
    await clickPlay();
    tick({ currentBpm: 135 });
    expect(byId('bpm-number').innerText).toBe('135');

    await clickPlay();
    expect(byId('bpm-number').innerText).toBe('100');

    // A tick still in flight after Stop must not bring the live BPM back
    tick({ currentBpm: 140 });
    expect(byId('bpm-number').innerText).toBe('100');
  });

  it('vis_01 render waits for latency', async () => {
    vi.useFakeTimers();
    await openPage();
    mockVisualDelay = 200;
    byId('trainer-enable').checked = true;
    byId('trainer-enable').dispatchEvent(new Event('change'));
    await clickPlay();
    mockGsap.fromTo.mockClear();

    tick({ currentBpm: 125, beatIndex: 4, activeTrackIds: [1] });

    vi.advanceTimersByTime(199);
    expectNoBeatRendered();

    vi.advanceTimersByTime(1);
    expect(byId('bpm-number').innerText).toBe('125');
    expect(byId('stadium-bpm').innerText).toBe('125.0');
    expect(byId('stadium-status').innerText).toContain('Trainer 120');
    expect(document.querySelector('.clock-label.active')?.textContent).toBe('2');

    const tweenFor = (target: Element) => mockGsap.fromTo.mock.calls.find(call => call[0] === target);
    const [, from, to] = tweenFor(byId('clock-hand'))!;
    expect(from).toMatchObject({ rotation: 90 });
    expect(to).toMatchObject({ rotation: 112.5, duration: 0.12 });
    expect(tweenFor(byId('orb-1'))).toBeDefined();
  });

  it('vis_03 stop cancels pending render', async () => {
    vi.useFakeTimers();
    await openPage();
    mockVisualDelay = 200;
    await clickPlay();
    mockGsap.fromTo.mockClear();
    tick({ currentBpm: 125, beatIndex: 4, activeTrackIds: [1] });

    await clickPlay(); // Stop
    tick({ currentBpm: 125, beatIndex: 5, activeTrackIds: [1] }); // Still in flight
    vi.advanceTimersByTime(300);
    expectNoBeatRendered();

    await clickPlay();
    tick({ currentBpm: 125, beatIndex: 4, activeTrackIds: [1] });
    await clickPlay(); // Stop
    await clickPlay(); // Play again, so only the cancel can stop the old tick
    vi.advanceTimersByTime(300);
    expectNoBeatRendered();
  });

  it('swing_01 no swing control', async () => {
    await openPage();
    await selectPreset('factory:jazz');

    expect(document.querySelector('#swing-slider')).toBeNull();
    expect(document.querySelector('#swing-display')).toBeNull();
    expect(document.querySelector('label[for="swing-slider"]')).toBeNull();
    const labels = [...document.querySelectorAll('#editor-view label, #editor-view .card-section-title')];
    expect(labels.length).toBeGreaterThan(0);
    labels.forEach(label => expect(label.textContent).not.toMatch(/swing/i));
  });

  it('swing_02 card title is Measure', async () => {
    await openPage();

    const card = byId('time-sig-num').closest('.card');
    expect(card?.querySelector('.card-section-title')?.textContent).toBe('Measure');
  });
});
