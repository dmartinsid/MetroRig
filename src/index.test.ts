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
      replaceTrainer = recorded('replaceTrainer');
      loadSample = mockLoadSample;
      setClickMode = mockSetClickMode;
      visualDelayMs = () => mockVisualDelay;
      sampleRate = () => 44100;

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

  it('train_22 preset load shows its start bpm during playback', async () => {
    const trainerOn = storedPreset();
    (trainerOn.trainerSettings as any).enabled = true;
    await openPage([trainerOn]);
    mockVisualDelay = 20;
    await clickPlay();
    tick({ currentBpm: 125, beatIndex: 4, activeTrackIds: [] }); // From the old preset, still delayed

    await selectPreset('user:stored');
    await new Promise(resolve => setTimeout(resolve, 40));
    expect(document.getElementById('bpm-number')!.innerText).toBe('80');
    expect(document.getElementById('stadium-bpm')!.innerText).toBe('80.0');
    expect((document.getElementById('bpm-slider') as HTMLInputElement).value).toBe('100');
  });

  it('train_17 preset load replaces trainer immediately', async () => {
    const trainerOn = storedPreset();
    (trainerOn.trainerSettings as any).enabled = true;
    await openPage([trainerOn]);
    await clickPlay();
    audioCalls.length = 0;

    await selectPreset('user:stored');
    expect(lastCall('replaceTrainer')[0]).toMatchObject({ enabled: true });
    expect(audioCalls.some(call => call.method === 'setTrainer')).toBe(false);

    audioCalls.length = 0;
    const increment = document.getElementById('trainer-inc') as HTMLInputElement;
    increment.value = '9';
    increment.onchange?.(new Event('change'));
    expect(lastCall('setTrainer')[0]).toMatchObject({ increment: 9 });
    expect(audioCalls.some(call => call.method === 'replaceTrainer')).toBe(false);
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

describe('Interface V2', () => {
  afterEach(() => {
    vi.useRealTimers();
    delete (globalThis as any).indexedDB;
    mockGsap.to.mockClear();
    mockGsap.set.mockClear();
    mockGsap.fromTo.mockClear();
  });

  const text = (selector: string) => document.querySelector(selector)?.textContent?.trim();

  it('shell_01 header controls', async () => {
    await openPage();

    const header = document.querySelector('header')!;
    expect(header.closest('main')).toBeNull();
    expect(header.querySelector('.logo')?.firstChild?.textContent).toBe('METRORIG');
    expect(header.querySelector('.badge')?.textContent).toBe('PRO');
    ['click-sound-selector', 'preset-selector', 'btn-toggle-view'].forEach(id => {
      expect(header.contains(byId(id))).toBe(true);
    });
  });

  it('shell_02 no dead controls', async () => {
    await openPage();

    const header = document.querySelector('header')!;
    expect(header.querySelectorAll('a, nav')).toHaveLength(0);
    expect(header.querySelectorAll('button')).toHaveLength(1);
    ['Grooves', 'Presets', 'tune', 'settings'].forEach(word => {
      const visible = [...header.childNodes].map(node => node.nodeName === 'DIV' ? '' : node.textContent).join(' ');
      expect(visible).not.toContain(word);
    });
  });

  it('shell_03 preset groups', async () => {
    await openPage();

    const groups = [...byId('preset-selector').querySelectorAll('optgroup')];
    expect(groups.map(group => group.label)).toEqual(['Time Signatures', 'Drum Grooves', 'Speed Trainer', 'User Presets']);
    groups.forEach(group => expect(group.children.length).toBeGreaterThan(0));
  });

  it('shell_09 no invented telemetry', async () => {
    await openPage();

    const footer = text('footer')!;
    expect(footer).not.toMatch(/V2\.4\.8|CPU|Hardware Parity|ENGINE/i);
  });

  it('edit_02 opening header', async () => {
    await openPage();
    expect(byId('panel-header-text').textContent).toBe('4/4 Metronome  ·  4/4  ·  120 BPM');
  });

  it('edit_16 tempo bus title', async () => {
    await openPage();

    const card = byId('bpm-number').closest('.card')!;
    expect(card.querySelector('.card-section-title')?.textContent).toBe('TEMPO BUS');
    expect(document.body.textContent).not.toContain('MASTER');
  });

  it('edit_19 no measure code', async () => {
    await openPage();
    expect(byId('time-sig-num').closest('.card')?.textContent).not.toContain('MTR-04');
  });

  it('edit_22 groove label', async () => {
    await openPage();
    expect(text('label[for="groove-selector"]')).toBe('Groove Library');
  });

  it('stad_03 legend', async () => {
    await openPage();

    const entries = [...document.querySelectorAll<HTMLElement>('.clock-legend [data-track]')];
    expect(entries.map(entry => [entry.dataset.track, entry.textContent])).toEqual([
      ['0', 'CLICK'], ['1', 'KICK'], ['2', 'SNARE'], ['3', 'HI-HAT'],
    ]);
  });

  it('stad_04 selector label', async () => {
    await openPage();
    expect(text('label[for="stadium-preset-selector"]')).toBe('SPEED TRAINER ROUTINE');
  });

  it('stad_05 timer label', async () => {
    await openPage();

    const block = byId('stadium-timer').parentElement!;
    expect(block.textContent).toContain('ELAPSED REHEARSAL');
  });

  it('stad_09 orb markup', async () => {
    await openPage();

    const names = ['CLICK', 'KICK', 'SNARE', 'HI-HAT'];
    names.forEach((name, trackId) => {
      const orb = byId(`orb-${trackId}`);
      expect(orb.dataset.track).toBe(String(trackId));
      expect(orb.querySelector('svg')).not.toBeNull();
      expect(orb.parentElement?.querySelector('.orb-name')?.textContent).toBe(name);
    });
  });

  it('mute_01 controls', async () => {
    await openPage();

    [0, 1, 2, 3].forEach(trackId => {
      expect(byId(`mute-${trackId}`).textContent).toBe('M');
      expect(byId(`solo-${trackId}`).textContent).toBe('S');
      expect(byId(`mute-${trackId}`).closest('[data-track]')?.getAttribute('data-track')).toBe(String(trackId));
    });
  });

  it('time_02 timer in both modes', async () => {
    await openPage();

    expect(byId('editor-view').contains(byId('editor-timer'))).toBe(true);
    expect(byId('stadium-view').contains(byId('stadium-timer'))).toBe(true);
    expect(byId('editor-timer').textContent).toBe('00:00:00');
    expect(byId('stadium-timer').textContent).toBe('00:00:00');
  });

  it('shell_04 editor toggle text', async () => {
    localStorage.removeItem('metrorig_view_mode');
    await openPage();
    expect(byId('btn-toggle-view').innerText).toBe('GO TO STADIUM MODE');
  });

  it('shell_05 stadium toggle text', async () => {
    localStorage.removeItem('metrorig_view_mode');
    await openPage();

    byId<HTMLButtonElement>('btn-toggle-view').click();
    expect(byId('btn-toggle-view').innerText).toBe('GO TO EDITOR MODE');
    expect(byId('stadium-view').classList.contains('hidden')).toBe(false);
    localStorage.removeItem('metrorig_view_mode');
  });

  it('shell_06 footer clock', async () => {
    await openPage();
    expect(byId('footer-clock').textContent).toBe('AUDIO CLOCK: 44.1 kHz 128 SPLS (2.9ms)');
  });

  it('shell_07 footer latency', async () => {
    await openPage();
    await clickPlay();
    mockVisualDelay = 12.34;
    vi.useFakeTimers();

    tick({ currentBpm: 120, beatIndex: 0 });
    vi.advanceTimersByTime(20);
    expect(byId('footer-latency').textContent).toBe('LATENCY: 12.3ms');
  });

  it('shell_08 latency placeholder', async () => {
    await openPage();
    expect(byId('footer-latency').textContent).toBe('LATENCY: --');
  });

  it('time_03 play restarts', async () => {
    await openPage();
    vi.useFakeTimers();
    await clickPlay();
    vi.advanceTimersByTime(3000);
    expect(byId('editor-timer').innerText).toBe('00:00:03');

    await clickPlay(); // Stop
    await clickPlay(); // Play again
    expect(byId('editor-timer').innerText).toBe('00:00:00');
    expect(byId('stadium-timer').innerText).toBe('00:00:00');
    await clickPlay();
  });

  it('time_04 stop keeps value', async () => {
    await openPage();
    vi.useFakeTimers();
    await clickPlay();
    vi.advanceTimersByTime(5000);

    await clickPlay(); // Stop
    vi.advanceTimersByTime(5000);
    expect(byId('editor-timer').innerText).toBe('00:00:05');
    expect(byId('stadium-timer').innerText).toBe('00:00:05');
  });

  it('time_06 same time', async () => {
    localStorage.removeItem('metrorig_view_mode');
    await openPage();
    vi.useFakeTimers();
    await clickPlay();
    vi.advanceTimersByTime(2000);

    byId<HTMLButtonElement>('btn-toggle-view').click();
    vi.advanceTimersByTime(1000);
    expect(byId('stadium-timer').innerText).toBe('00:00:03');
    expect(byId('editor-timer').innerText).toBe('00:00:03');

    await clickPlay();
    localStorage.removeItem('metrorig_view_mode');
  });

  const cell = (trackId: number, step: number) =>
    document.querySelectorAll<HTMLElement>(`.step-cell[data-track="${trackId}"]`)[step];

  it('edit_05 beat sub label', async () => {
    await openPage();

    const first = byId('grid-container').firstElementChild as HTMLElement;
    expect(first.innerText).toBe('BEAT/SUB');
    expect(first.style.gridColumn).toBe('1');
    expect(first.style.gridRow).toBe('1');
  });

  it('edit_06 hit mark', async () => {
    await openPage();
    await selectPreset('factory:rock');

    expect(cell(1, 0).classList.contains('active')).toBe(true);
    expect(cell(1, 0).innerText).toBe('●');
    expect(cell(1, 1).innerText).toBe('');
  });

  it('edit_07 accent mark', async () => {
    await openPage();

    expect(cell(0, 0).classList.contains('accent')).toBe(true);
    expect(cell(0, 0).innerText).toBe('▲');
    expect(cell(0, 4).innerText).toBe('●');

    cell(0, 1).click(); // Off to hit
    cell(0, 1).click(); // Hit to accent
    expect(cell(0, 1).innerText).toBe('▲');
  });

  it('edit_08 beat spacer', async () => {
    await openPage();

    const columns = byId('grid-container').style.gridTemplateColumns.split(' ');
    expect(columns.filter(column => column === '0.5rem')).toHaveLength(3);
    expect(columns.filter(column => column === '1fr')).toHaveLength(16);
    expect(columns.slice(0, 7)).toEqual(['auto', '1fr', '1fr', '1fr', '1fr', '0.5rem', '1fr']);
  });

  it('edit_09 sustain kept', async () => {
    await openPage();
    await selectPreset('factory:trainer_gallop');

    expect(cell(1, 1).classList.contains('sustain')).toBe(true); // Eighth of the gallop
    expect(cell(1, 1).innerText).toBe('');
    expect(cell(1, 2).classList.contains('sustain')).toBe(false);
  });
});
