import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { MetronomeNode } from './audio/MetronomeNode';
import { SONGS } from './songs';
import { STADIUM_GROUPS, TRACKS } from './kit';

const mockInit = vi.fn().mockResolvedValue(undefined);
const mockLoadSample = vi.fn().mockResolvedValue(undefined);
const mockLoadTake = vi.fn().mockResolvedValue(undefined);
const mockSetClickMode = vi.fn();
const mockPadLoad = vi.fn().mockResolvedValue(undefined);

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
      setBars = recorded('setBars');
      restartPattern = recorded('restartPattern');
      updateGrid = recorded('updateGrid');
      setTrainer = recorded('setTrainer');
      replaceTrainer = recorded('replaceTrainer');
      loadSample = mockLoadSample;
      loadTake = mockLoadTake;
      setClickMode = mockSetClickMode;
      padPlay = recorded('padPlay');
      padStop = recorded('padStop');
      padVolume = recorded('padVolume');
      padLoad = mockPadLoad;
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
    const hiHatSent = calls('updateGrid').filter(([trackId]) => trackId === 3).at(-1)!;
    expect([...hiHatSent[1]]).toEqual(new Array(12).fill(1));

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
    ['click-sound-selector', 'preset-selector', 'nav-editor', 'nav-stadium', 'nav-grooves'].forEach(id => {
      expect(header.contains(byId(id))).toBe(true);
    });
  });

  it('shell_02 no dead controls', async () => {
    await openPage();

    const header = document.querySelector('header')!;
    expect(header.querySelectorAll('a')).toHaveLength(0);
    expect(header.querySelectorAll('button')).toHaveLength(4);
    ['Presets', 'tune', 'settings'].forEach(word => {
      const visible = [...header.childNodes].map(node => node.nodeName === 'DIV' ? '' : node.textContent).join(' ');
      expect(visible).not.toContain(word);
    });
  });

  it('shell_03 preset groups', async () => {
    await openPage();

    const groups = [...byId('preset-selector').querySelectorAll('optgroup')];
    expect(groups.map(group => group.label)).toEqual(['Time Signatures', 'Drum Grooves', 'Songs', 'Speed Trainer', 'User Presets']);
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
      ['0', 'CLICK'], ['1', 'KICK'], ['2', 'SNARE/TOMS'], ['3', 'CYMBALS'],
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

    const names = ['CLICK', 'KICK', 'SNARE/TOMS', 'CYMBALS'];
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

    byId<HTMLButtonElement>('nav-stadium').click();
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

  const position = () => document.querySelector('.pattern-pos')?.textContent;

  it('edit_03 dot lit playing', async () => {
    await openPage();
    await clickPlay();
    expect(byId('sequencer-dot').classList.contains('lit')).toBe(true);
  });

  it('edit_04 dot unlit stopped', async () => {
    await openPage();
    expect(byId('sequencer-dot').classList.contains('lit')).toBe(false);

    await clickPlay();
    await clickPlay();
    expect(byId('sequencer-dot').classList.contains('lit')).toBe(false);
  });

  it('edit_10 pattern name', async () => {
    await openPage();
    await selectPreset('factory:rock');
    expect(byId('pattern-name').textContent).toBe('PAT: Rock Groove');

    byId('preset-name').value = 'My take';
    byId<HTMLButtonElement>('btn-save').click();
    await flush();
    expect(byId('pattern-name').textContent).toBe('PAT: My take');
  });

  it('edit_11 steps label', async () => {
    await openPage();
    expect(byId('pattern-steps').textContent).toBe('STEPS: 16/128');

    await selectPreset('factory:blues');
    expect(byId('pattern-steps').textContent).toBe('STEPS: 24/128');
  });

  it('edit_12 resolution label', async () => {
    await openPage();
    expect(document.querySelector('.pattern-bar')?.textContent).toContain('RESOLUTION: 1/16th');
  });

  it('edit_13 stopped position', async () => {
    await openPage();
    expect(position()).toBe('POS: BAR 01 · STEP 01');
  });

  it('edit_14 tick position', async () => {
    await openPage();
    await clickPlay();

    tick({ currentBpm: 120, beatIndex: 5 });
    expect(position()).toBe('POS: BAR 01 · STEP 06');
  });

  it('edit_15 bar count', async () => {
    await openPage();
    await clickPlay();

    tick({ currentBpm: 120, beatIndex: 0 });
    expect(position()).toBe('POS: BAR 01 · STEP 01');
    tick({ currentBpm: 120, beatIndex: 15 });
    tick({ currentBpm: 120, beatIndex: 0 });
    expect(position()).toBe('POS: BAR 02 · STEP 01');
    tick({ currentBpm: 120, beatIndex: 15 });
    tick({ currentBpm: 120, beatIndex: 0 });
    expect(position()).toBe('POS: BAR 03 · STEP 01');
  });

  it('edge_02 steps follow', async () => {
    await openPage();
    await clickPlay();

    byId('time-sig-num').value = '3';
    byId('time-sig-num').dispatchEvent(new Event('change'));
    expect(byId('pattern-steps').textContent).toBe('STEPS: 12/128');
  });

  it('edge_03 stop resets position', async () => {
    await openPage();
    await clickPlay();
    tick({ currentBpm: 120, beatIndex: 15 });
    tick({ currentBpm: 120, beatIndex: 0 });
    tick({ currentBpm: 120, beatIndex: 5 });

    await clickPlay(); // Stop
    expect(position()).toBe('POS: BAR 01 · STEP 01');

    await clickPlay();
    tick({ currentBpm: 120, beatIndex: 0 });
    expect(position()).toBe('POS: BAR 01 · STEP 01');
  });

  const stepper = (id: string) => byId<HTMLButtonElement>(id).click();

  it('edit_17 slider scale', async () => {
    await openPage();
    await selectPreset('factory:metal');

    const labels = [...document.querySelectorAll('.slider-scale span')].map(label => label.textContent);
    expect(labels).toEqual(['40', '140', '240']);
  });

  it('edit_18 slider label follows', async () => {
    await openPage();

    byId('bpm-slider').value = '150';
    byId('bpm-slider').dispatchEvent(new Event('input'));
    expect(byId('bpm-slider-value').innerText).toBe('150');
  });

  it('edit_20 numerator stepper', async () => {
    await openPage();

    stepper('time-sig-num-up');
    expect(byId('time-sig-num').value).toBe('5');
    expect(byId('pattern-steps').textContent).toBe('STEPS: 20/128');
    expect(byId('panel-header-text').textContent).toContain('5/4');

    stepper('time-sig-num-down');
    expect(byId('time-sig-num').value).toBe('4');

    ['3', '2', '1', '1'].forEach(value => {
      stepper('time-sig-num-down');
      expect(byId('time-sig-num').value).toBe(value);
    });

    stepper('time-sig-den-up');
    stepper('time-sig-den-up'); // /16
    byId('time-sig-num').value = '16';
    stepper('time-sig-num-up');
    expect(byId('time-sig-num').value).toBe('16');
  });

  it('edit_21 denominator stepper', async () => {
    await openPage();

    const den = () => byId<HTMLSelectElement>('time-sig-den').value;
    stepper('time-sig-den-up');
    expect(den()).toBe('8');
    expect(byId('pattern-steps').textContent).toBe('STEPS: 8/128');
    stepper('time-sig-den-up');
    expect(den()).toBe('16');
    stepper('time-sig-den-up');
    expect(den()).toBe('16');
    stepper('time-sig-den-down');
    stepper('time-sig-den-down');
    expect(den()).toBe('4');
    stepper('time-sig-den-down');
    expect(den()).toBe('4');
  });

  it('edit_24 metalcore applied', async () => {
    await openPage();

    const grooves = byId<HTMLSelectElement>('groove-selector');
    expect([...grooves.options].map(option => option.text)).toContain('Metalcore Breakdown');
    grooves.value = 'factory:metalcore';
    grooves.dispatchEvent(new Event('change'));

    const hits = (trackId: number) => [...document.querySelectorAll(`.step-cell[data-track="${trackId}"]`)]
      .flatMap((step, index) => step.classList.contains('active') ? [index] : []);
    expect(hits(1)).toEqual([0, 3, 5, 8, 11, 13]);
    expect(hits(2)).toEqual([8]);
    expect(hits(3)).toEqual([0, 2, 4, 6, 8, 10, 12, 14]);
    expect(byId('bpm-number').innerText).toBe('120');
    expect(byId('bpm-slider').value).toBe('120');
  });

  it('edit_25 trainer starts open', async () => {
    await openPage();

    expect(mockGsap.set).toHaveBeenCalledWith(byId('trainer-chevron'), { rotation: 180 });
    byId('trainer-toggle').click(); // The first click closes it
    expect(mockGsap.to.mock.calls.find(call => call[0] === byId('trainer-body'))?.[1]).toMatchObject({ height: 0 });
  });

  it('edit_26 trainer switch', async () => {
    await openPage();
    await clickPlay();

    const toggle = (checked: boolean) => {
      byId('trainer-enable').checked = checked;
      byId('trainer-enable').dispatchEvent(new Event('change'));
    };
    toggle(true);
    expect(lastCall('setTrainer')[0].enabled).toBe(true);
    toggle(false);
    expect(lastCall('setTrainer')[0].enabled).toBe(false);
  });

  it('edit_27 steady dot', async () => {
    await openPage();

    byId('trainer-enable').checked = true;
    byId('trainer-enable').dispatchEvent(new Event('change'));
    expect(byId('trainer-dot').classList.contains('visible')).toBe(true);

    const css = fs.readFileSync(path.resolve(__dirname, './index.css'), 'utf8');
    expect(css).not.toMatch(/@keyframes|animation\s*:/);
    expect(mockGsap.fromTo.mock.calls.some(call => call[0] === byId('trainer-dot'))).toBe(false);
    expect(mockGsap.to.mock.calls.some(call => call[0] === byId('trainer-dot'))).toBe(false);
  });

  const toastShown = () => mockGsap.set.mock.calls.some(
    call => call[0] === byId('save-toast') && call[1].display === 'flex');

  it('edit_28 toast after edit', async () => {
    await openPage();
    await selectPreset('factory:rock');

    document.querySelector<HTMLElement>('.step-cell[data-track="1"]')!.click();
    expect(toastShown()).toBe(true);
    expect(byId('preset-name').value).toBe('Rock Groove');
  });

  it('edit_29 toast hidden', async () => {
    await openPage();
    await selectPreset('factory:rock');
    expect(toastShown()).toBe(false);

    const grooves = byId<HTMLSelectElement>('groove-selector');
    grooves.value = 'factory:rock';
    grooves.dispatchEvent(new Event('change'));
    mockGsap.set.mockClear();
    stepper('time-sig-den-down'); // Already at /4
    expect(toastShown()).toBe(false);
    expect(grooves.value).toBe('factory:rock');

    await openPage([storedPreset({ timeSignature: '1/4', measureLength: 4 })]);
    await selectPreset('user:stored');
    mockGsap.set.mockClear();
    stepper('time-sig-num-down'); // Already at 1
    expect(toastShown()).toBe(false);

    document.querySelector<HTMLElement>('.step-cell[data-track="1"]')!.click();
    expect(toastShown()).toBe(true);
    mockGsap.to.mockClear();
    await selectPreset('factory:rock'); // A load discards the edit
    expect(mockGsap.to.mock.calls.find(call => call[0] === byId('save-toast'))?.[1]).toMatchObject({ opacity: 0 });
  });

  it('edge_01 stepper limit', async () => {
    await openPage();
    const alertSpy = vi.fn();
    vi.stubGlobal('alert', alertSpy);

    byId('time-sig-num').value = '8';
    byId('time-sig-num').dispatchEvent(new Event('change'));
    stepper('time-sig-num-up'); // 9/4 needs 36 steps

    expect(alertSpy).toHaveBeenCalledWith('Time signature exceeds the maximum limit of 32 steps!');
    expect(byId('time-sig-num').value).toBe('8');
    expect(document.querySelectorAll('.step-cell[data-track="0"]')).toHaveLength(32);
  });

  const sentTo = (trackId: number) => [...calls('updateGrid').filter(call => call[0] === trackId).at(-1)![1]];
  const realKick = [1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0];
  const silence = new Array(16).fill(0);
  const pressMute = (trackId: number) => byId<HTMLButtonElement>(`mute-${trackId}`).click();
  const orbTweened = (trackId: number) => mockGsap.fromTo.mock.calls.some(call => call[0] === byId(`orb-${trackId}`));

  it('mute_02 mute silences', async () => {
    await openPage();
    await selectPreset('factory:rock');
    await clickPlay();

    pressMute(1);
    expect(sentTo(1)).toEqual(silence);
    expect(sentTo(3)).not.toEqual(silence);
    expect(byId('mute-1').getAttribute('aria-pressed')).toBe('true');
  });

  it('mute_03 unmute restores', async () => {
    await openPage();
    await selectPreset('factory:rock');
    await clickPlay();

    pressMute(1);
    pressMute(1);
    expect(sentTo(1)).toEqual(realKick);
    expect(byId('mute-1').getAttribute('aria-pressed')).toBe('false');
  });

  it('mute_07 row dimmed', async () => {
    await openPage();

    pressMute(1);
    const silencedTracks = (selector: string) => [...document.querySelectorAll<HTMLElement>(selector)]
      .filter(element => element.classList.contains('silenced')).map(element => element.dataset.track);
    expect(new Set(silencedTracks('.step-cell'))).toEqual(new Set(['1']));
    expect(silencedTracks('.track-label')).toEqual(['1']);
    expect(document.querySelectorAll('.step-cell.silenced')).toHaveLength(16);

    byId<HTMLButtonElement>('solo-2').click(); // Solo silences every other track
    expect(new Set(silencedTracks('.step-cell'))).toEqual(new Set(['0', '1', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12']));
  });

  it('mute_08 orb still', async () => {
    await openPage();
    await clickPlay();
    pressMute(1);
    mockGsap.fromTo.mockClear();

    tick({ currentBpm: 120, beatIndex: 0, activeTrackIds: [1, 2] }); // Already in flight
    expect(orbTweened(1)).toBe(false);
    expect(orbTweened(2)).toBe(true);
  });

  it('mute_09 edit kept silent', async () => {
    await openPage();
    await selectPreset('factory:rock');
    await clickPlay();
    pressMute(1);

    document.querySelectorAll<HTMLElement>('.step-cell[data-track="1"]')[2].click();
    expect(sentTo(1)).toEqual(silence);

    pressMute(1);
    expect(sentTo(1)).toEqual([1, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0]);
  });

  it('mute_10 saves real grid', async () => {
    const stores = await openPage();
    await selectPreset('factory:rock');
    await clickPlay();
    pressMute(1);

    byId('preset-name').value = 'Muted take';
    byId<HTMLButtonElement>('btn-save').click();
    await flush();
    const saved = [...stores.presets.values()].find(preset => preset.name === 'Muted take');
    expect(saved.gridData[1]).toEqual(realKick);

    vi.stubGlobal('prompt', () => 'Muted groove');
    vi.stubGlobal('alert', vi.fn());
    byId<HTMLButtonElement>('btn-save-groove').click();
    await flush();
    const groove = [...stores.grooves.values()].find(item => item.name === 'Muted groove');
    expect(groove.gridData[1]).toEqual(realKick);
  });

  it('mute_11 survives load', async () => {
    await openPage();
    await clickPlay();
    pressMute(1);

    await selectPreset('factory:metal');
    expect(byId('mute-1').getAttribute('aria-pressed')).toBe('true');
    expect(sentTo(1)).toEqual(silence);
    expect(document.querySelector('.track-label[data-track="1"]')?.classList.contains('silenced')).toBe(true);

    byId<HTMLButtonElement>('solo-2').click();
    await selectPreset('factory:rock');
    expect(byId('solo-2').getAttribute('aria-pressed')).toBe('true');
    expect(sentTo(3)).toEqual(silence);

    const grooves = byId<HTMLSelectElement>('groove-selector');
    grooves.value = 'factory:metal';
    grooves.dispatchEvent(new Event('change'));
    expect(byId('solo-2').getAttribute('aria-pressed')).toBe('true');
    expect(byId('mute-1').getAttribute('aria-pressed')).toBe('true');
    expect(sentTo(3)).toEqual(silence);
  });

  it('mute_12 play sends empty', async () => {
    await openPage();
    await selectPreset('factory:rock');
    pressMute(1);

    await clickPlay();
    expect(sentTo(1)).toEqual(silence);
    expect(sentTo(3)).toEqual([1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0]);
  });

  it('mute_13 reload clears', async () => {
    await openPage();
    pressMute(1);
    byId<HTMLButtonElement>('solo-2').click();

    await openPage();
    await selectPreset('factory:rock');
    await clickPlay();
    expect(byId('mute-1').getAttribute('aria-pressed')).toBe('false');
    expect(byId('solo-2').getAttribute('aria-pressed')).toBe('false');
    expect(sentTo(1)).toEqual(realKick);
  });

  it('edge_05 all muted continues', async () => {
    await openPage();
    vi.useFakeTimers();
    await clickPlay();
    [0, 1, 2, 3].forEach(pressMute);
    mockGsap.fromTo.mockClear();

    tick({ currentBpm: 120, beatIndex: 3 });
    vi.advanceTimersByTime(1000);
    expect(document.querySelector('.pattern-pos')?.textContent).toBe('POS: BAR 01 · STEP 04');
    expect(mockGsap.fromTo.mock.calls.some(call => call[0] === byId('clock-hand'))).toBe(true);
    expect(byId('editor-timer').innerText).toBe('00:00:01');
    expect(lastCall('stop')).toBeUndefined();
  });

  it('edge_06 groove stays silent', async () => {
    await openPage();
    await clickPlay();
    pressMute(1);

    const grooves = byId<HTMLSelectElement>('groove-selector');
    grooves.value = 'factory:rock';
    grooves.dispatchEvent(new Event('change'));
    expect(sentTo(1)).toEqual(silence);

    pressMute(1);
    expect(sentTo(1)).toEqual(realKick);
  });

  it('stad_02 ring order', async () => {
    await openPage();

    const arcs = [0, 1, 2, 3].map(trackId => {
      const slice = document.querySelector(`.clock-slice[data-track="${trackId}"]`)!;
      return [...slice.getAttribute('d')!.matchAll(/A ([\d.]+)/g)].map(match => Number(match[1]));
    });
    arcs.forEach(([outer, inner]) => expect(inner).toBeLessThan(outer));
    for (let ring = 1; ring < 4; ring++) {
      expect(arcs[ring][0]).toBeLessThan(arcs[ring - 1][1]); // A gap between rings
    }
  });

  it('stad_06 tempo format', async () => {
    await openPage();
    expect(byId('stadium-bpm').innerText).toBe('120.0');
    expect(byId('stadium-bpm').parentElement?.textContent).toContain('BPM');

    await clickPlay();
    tick({ currentBpm: 133.25 });
    expect(byId('stadium-bpm').innerText).toBe('133.3');
  });

  it('stad_07 trainer status', async () => {
    localStorage.removeItem('metrorig_view_mode');
    await openPage();

    await selectPreset('factory:trainer_calvagada_148_190');
    expect(byId('stadium-status').innerText).toBe('Trainer 148 → 190 BPM · +2 every 3 bars');
    expect(byId('stadium-status-dot').classList.contains('lit')).toBe(true);

    await selectPreset('factory:default'); // Off, then turned on by hand in the Editor
    byId('trainer-enable').checked = true;
    byId('trainer-enable').dispatchEvent(new Event('change'));
    byId<HTMLButtonElement>('nav-stadium').click();
    expect(byId('stadium-status').innerText).toBe('Trainer 120 → 160 BPM · +5 every 4 bars');
    localStorage.removeItem('metrorig_view_mode');
  });

  it('stad_08 trainer off', async () => {
    await openPage();
    await selectPreset('factory:rock');
    expect(byId('stadium-status').innerText).toBe('Trainer Off');
    expect(byId('stadium-status-dot').classList.contains('lit')).toBe(false);
  });

  it('stad_10 orb pulse', async () => {
    await openPage();
    await clickPlay();
    mockGsap.fromTo.mockClear();

    tick({ currentBpm: 120, activeTrackIds: [2] });
    const tween = mockGsap.fromTo.mock.calls.find(call => call[0] === byId('orb-2'))!;
    expect(tween[1]).toEqual({ scale: 1.15 });
    expect(tween[2]).toMatchObject({ scale: 1.0, duration: 0.2 });
    expect(tween[1]).not.toHaveProperty('backgroundColor');
    expect(tween[2]).not.toHaveProperty('backgroundColor');
  });

  it('stad_11 orb inert', async () => {
    await openPage();
    await clickPlay();
    audioCalls.length = 0;
    mockGsap.fromTo.mockClear();

    [0, 1, 2, 3].forEach(trackId => byId(`orb-${trackId}`).click());
    expect(audioCalls).toHaveLength(0);
    expect(mockGsap.fromTo).not.toHaveBeenCalled();
    [0, 1, 2, 3].forEach(trackId => expect(byId(`mute-${trackId}`).getAttribute('aria-pressed')).toBe('false'));
  });

  it('stad_12 clock behaviours', async () => {
    await openPage();
    await selectPreset('factory:trainer_gallop');
    await clickPlay();
    mockGsap.fromTo.mockClear();

    const slices = [...document.querySelectorAll('.clock-slice[data-track="1"]')];
    expect(slices).toHaveLength(16);
    expect(slices[0].classList.contains('on')).toBe(true);
    expect(slices[1].classList.contains('sustain')).toBe(true);

    tick({ currentBpm: 120, beatIndex: 4 });
    expect(document.querySelector('.clock-label.active')?.textContent).toBe('2');
    const hand = mockGsap.fromTo.mock.calls.find(call => call[0] === byId('clock-hand'))!;
    expect(hand[1]).toMatchObject({ rotation: 90 });
    expect(hand[2]).toMatchObject({ rotation: 112.5 });
  });

  it('edge_04 stadium placeholder', async () => {
    await openPage();
    await selectPreset('factory:rock');

    const selector = byId<HTMLSelectElement>('stadium-preset-selector');
    expect(selector.options[selector.selectedIndex].text).toBe('Choose a speed trainer');
  });

  it('stad_13 tempo follows slider and stop', async () => {
    await openPage();
    byId('bpm-slider').value = '150';
    byId('bpm-slider').dispatchEvent(new Event('input'));
    expect(byId('stadium-bpm').innerText).toBe('150.0');

    await clickPlay();
    tick({ currentBpm: 170 });
    expect(byId('stadium-bpm').innerText).toBe('170.0');
    await clickPlay(); // Stop
    expect(byId('stadium-bpm').innerText).toBe('150.0');
    expect(byId('bpm-number').innerText).toBe('150');
  });

  it('edit_30 header follows save', async () => {
    await openPage();
    await selectPreset('factory:rock');

    byId('preset-name').value = 'Take';
    byId<HTMLButtonElement>('btn-save').click();
    await flush();
    expect(byId('panel-header-text').textContent).toBe('Take  ·  4/4  ·  120 BPM');
  });

  it('edit_31 first click after save', async () => {
    await openPage();
    await selectPreset('factory:rock');
    await clickPlay();

    byId('preset-name').value = 'Take';
    byId<HTMLButtonElement>('btn-save').click();
    await flush();

    const target = document.querySelectorAll<HTMLElement>('.step-cell[data-track="1"]')[2];
    target.click();
    expect(document.querySelectorAll('.step-cell[data-track="1"]')[2].classList.contains('active')).toBe(true);
    expect(sentTo(1).slice(0, 3)).toEqual([1, 0, 1]);
  });
});

describe('Grooves Library', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    delete (globalThis as any).indexedDB;
    localStorage.removeItem('metrorig_view_mode');
    mockGsap.to.mockClear();
    mockGsap.set.mockClear();
    mockGsap.fromTo.mockClear();
  });

  it('kit_06 failed sample stays local', async () => {
    const failure = new Error('404');
    mockLoadSample.mockReset();
    mockLoadSample.mockImplementation((sampleId: number) =>
      sampleId === 8 ? Promise.reject(failure) : Promise.resolve());
    const logged = vi.spyOn(console, 'error').mockImplementation(() => {});
    await openPage();
    await clickPlay();

    expect(mockLoadSample.mock.calls.map(([id]) => id).sort((a, b) => a - b)).toEqual([3, 4, 5, 6, 7, 8]);
    expect(logged).toHaveBeenCalledWith('Failed to load /kit/china.wav:', failure);
    expect(calls('start')).toHaveLength(1);
    expect(byId('btn-play').classList.contains('playing')).toBe(true);
    await clickPlay();
  });

  const cell = (trackId: number, step: number) =>
    document.querySelectorAll<HTMLElement>(`.step-cell[data-track="${trackId}"]`)[step];

  // Clicks a cell and returns what it shows afterwards
  const stepThrough = (trackId: number) => {
    const seen = [];
    for (let i = 0; i < 4; i++) {
      cell(trackId, 1).click();
      seen.push([...cell(trackId, 1).classList].filter(name => ['active', 'accent', 'ghost'].includes(name)).join());
    }
    return seen;
  };

  it('edt_01 grid holds every track', async () => {
    await openPage();

    expect([...document.querySelectorAll('.track-label')].map(label => (label as HTMLElement).innerText)).toEqual([
      'Click', 'Kick', 'Snare', 'Hi-hat', 'Open Hat', 'Ride', 'Ride Bell', 'Crash', 'China',
      'High Tom', 'Mid Tom', 'Low Tom', 'Floor Tom',
    ]);
    expect(document.querySelectorAll('.step-cell')).toHaveLength(13 * 16);
  });

  it('dyn_02 drum cell cycle', async () => {
    await openPage();
    expect(stepThrough(8)).toEqual(['active', 'accent', 'ghost', '']);
  });

  it('dyn_03 click cell cycle', async () => {
    await openPage();
    expect(stepThrough(0)).toEqual(['active', 'accent', '', 'active']);
  });

  it('dyn_04 cell symbols', async () => {
    await openPage();
    const symbols = [];
    for (let i = 0; i < 3; i++) {
      cell(2, 1).click();
      symbols.push(cell(2, 1).innerText);
    }
    expect(symbols).toEqual(['●', '▲', '•']);
  });

  it('dyn_05 figure writes normal', async () => {
    await openPage();
    cell(9, 1).click();
    cell(9, 1).click(); // Accent, so the stamp must overwrite it

    [...document.querySelectorAll<HTMLElement>('.figure-btn')].find(btn => btn.innerText.startsWith('16ths'))!.click();
    cell(9, 0).click();

    expect([0, 1, 2, 3].map(step => cell(9, step).classList.contains('active'))).toEqual([true, true, true, true]);
  });

  it('dyn_06 dynamics survive save and load', async () => {
    const stores = await openPage();
    cell(1, 0).click();
    cell(1, 0).click();
    cell(2, 0).click();
    cell(2, 0).click();
    cell(2, 0).click();
    byId('preset-name').value = 'Dynamics';
    byId<HTMLButtonElement>('btn-save').click();
    await flush();

    const saved = [...stores.presets.values()].find(preset => preset.name === 'Dynamics');
    expect(saved.gridData[1][0]).toBe(2);
    expect(saved.gridData[2][0]).toBe(3);

    await selectPreset('factory:rock');
    await selectPreset(`user:${saved.id}`);
    expect(cell(1, 0).classList.contains('accent')).toBe(true);
    expect(cell(2, 0).classList.contains('ghost')).toBe(true);
  });

  it('edt_02 thirteen mix cards', async () => {
    await openPage();

    const cards = [...document.querySelectorAll<HTMLElement>('.track-mix-card')];
    expect(cards.map(card => card.querySelector('.track-mix-name')?.textContent)).toEqual([
      'CLICK', 'KICK', 'SNARE', 'HI-HAT', 'OPEN HAT', 'RIDE', 'RIDE BELL', 'CRASH', 'CHINA',
      'HIGH TOM', 'MID TOM', 'LOW TOM', 'FLOOR TOM',
    ]);
    const ids = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 11, 12, 10]; // Grid order, not id order
    cards.forEach((card, position) => {
      const trackId = ids[position];
      expect(card.dataset.track).toBe(String(trackId));
      expect(card.querySelector(`#mute-${trackId}`)?.textContent).toBe('M');
      expect(card.querySelector(`#solo-${trackId}`)?.textContent).toBe('S');
    });
  });

  it('edt_03 new track obeys mix', async () => {
    await openPage();
    cell(8, 0).click();
    await clickPlay();
    const china = () => [...calls('updateGrid').filter(([trackId]) => trackId === 8).at(-1)![1]][0];
    expect(china()).toBe(1);

    byId<HTMLButtonElement>('mute-8').click();
    expect(byId('mute-8').getAttribute('aria-pressed')).toBe('true');
    expect(china()).toBe(0);
    expect(cell(8, 0).classList.contains('silenced')).toBe(true);

    byId<HTMLButtonElement>('solo-8').click();
    expect(china()).toBe(1); // A solo beats a mute, as on every other track
    expect(cell(1, 0).classList.contains('silenced')).toBe(true);
    await clickPlay();
  });

  it('edt_04 groove clears other tracks', async () => {
    await openPage();
    cell(7, 0).click();
    cell(1, 2).click();

    const grooves = byId<HTMLSelectElement>('groove-selector');
    grooves.value = 'factory:rock';
    grooves.dispatchEvent(new Event('change'));

    expect(cell(7, 0).classList.contains('active')).toBe(false);
    expect(cell(1, 2).classList.contains('active')).toBe(false);
    expect(cell(1, 0).classList.contains('active')).toBe(true);
    expect(cell(0, 0).classList.contains('accent')).toBe(true); // Click belongs to the meter, not the groove
    expect(cell(0, 4).classList.contains('active')).toBe(true);
  });

  it('edt_05 save groove keeps the kit', async () => {
    const stores = await openPage();
    cell(7, 0).click();
    cell(10, 3).click();
    cell(10, 3).click();
    vi.stubGlobal('prompt', vi.fn(() => 'Whole kit'));
    vi.stubGlobal('alert', vi.fn());
    byId<HTMLButtonElement>('btn-save-groove').click();
    await flush();

    const saved = [...stores.grooves.values()].find(groove => groove.name === 'Whole kit');
    expect(Object.keys(saved.gridData)).toEqual(['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12']);
    expect(saved.gridData[7][0]).toBe(1);
    expect(saved.gridData[10][3]).toBe(2);
  });

  const orbPulsed = (group: number) => mockGsap.fromTo.mock.calls.some(call => call[0] === byId(`orb-${group}`));

  it('std_01 four group labels', async () => {
    await openPage();

    const labels = ['CLICK', 'KICK', 'SNARE/TOMS', 'CYMBALS'];
    expect([...document.querySelectorAll('.clock-legend span')].map(entry => entry.textContent)).toEqual(labels);
    expect([...document.querySelectorAll('.orb-name')].map(name => name.textContent)).toEqual(labels);
    expect(document.querySelectorAll('.orb')).toHaveLength(4);

    const rings = new Set([...document.querySelectorAll('.clock-slice')].map(slice => slice.getAttribute('data-track')));
    expect(rings).toEqual(new Set(['0', '1', '2', '3']));
  });

  it('std_04 ring lights for any track of its group', async () => {
    await openPage();
    const ringOn = (ring: number, step: number) =>
      document.querySelectorAll(`.clock-slice[data-track="${ring}"]`)[step].classList.contains('on');

    cell(10, 1).click(); // Floor Tom
    cell(8, 5).click(); // China
    expect(ringOn(2, 1)).toBe(true);
    expect(ringOn(3, 5)).toBe(true);
    expect(ringOn(3, 1)).toBe(false);
  });

  it('std_05 orb pulses for its group', async () => {
    await openPage();
    await clickPlay();
    mockGsap.fromTo.mockClear();

    tick({ currentBpm: 120, activeTrackIds: [9] }); // High Tom
    expect(orbPulsed(2)).toBe(true);
    expect(orbPulsed(3)).toBe(false);

    mockGsap.fromTo.mockClear();
    tick({ currentBpm: 120, activeTrackIds: [7] }); // Crash
    expect(orbPulsed(3)).toBe(true);
    expect(orbPulsed(2)).toBe(false);
    await clickPlay();
  });

  it('std_06 silenced group stays still', async () => {
    await openPage();
    await clickPlay();
    [2, 9, 10].forEach(trackId => byId<HTMLButtonElement>(`mute-${trackId}`).click());
    byId<HTMLButtonElement>('mute-3').click();
    mockGsap.fromTo.mockClear();

    tick({ currentBpm: 120, activeTrackIds: [2, 9, 10, 3, 7] }); // Already in flight
    expect(orbPulsed(2)).toBe(false);
    expect(orbPulsed(3)).toBe(true); // Crash is still audible, so its group pulses
    await clickPlay();
  });

  const openScreen = (name: 'editor' | 'stadium' | 'grooves') => byId<HTMLButtonElement>(`nav-${name}`).click();
  const shownScreens = () => ['editor-view', 'stadium-view', 'grooves-view'].filter(id => !byId(id).classList.contains('hidden'));

  it('nav_01 header links', async () => {
    await openPage();
    expect([...document.querySelectorAll('header nav button')].map(link => link.textContent)).toEqual(['Editor', 'Stadium', 'Grooves', 'Improv']);
  });

  it('nav_02 editor link', async () => {
    await openPage();
    openScreen('grooves');
    openScreen('editor');
    expect(shownScreens()).toEqual(['editor-view']);
  });

  it('nav_03 stadium link', async () => {
    await openPage();
    openScreen('stadium');
    expect(shownScreens()).toEqual(['stadium-view']);
  });

  it('nav_04 grooves link', async () => {
    await openPage();
    openScreen('grooves');
    expect(shownScreens()).toEqual(['grooves-view']);
  });

  it('nav_05 aria current', async () => {
    await openPage();
    const current = () => [...document.querySelectorAll('[aria-current]')].map(link => [link.textContent, link.getAttribute('aria-current')]);

    expect(current()).toEqual([['Editor', 'page']]);
    openScreen('grooves');
    expect(current()).toEqual([['Grooves', 'page']]);
    openScreen('stadium');
    expect(current()).toEqual([['Stadium', 'page']]);
  });

  it('nav_06 no toggle no presets', async () => {
    await openPage();
    const header = document.querySelector('header')!;
    expect(byId('btn-toggle-view')).toBeNull();
    expect(header.textContent).not.toContain('GO TO');
    expect([...header.querySelectorAll('nav button')].map(link => link.textContent)).not.toContain('Presets');
  });

  it('nav_07 reload opens the last screen', async () => {
    await openPage();
    openScreen('grooves');
    await openPage();
    expect(shownScreens()).toEqual(['grooves-view']);
    expect(byId('nav-grooves').getAttribute('aria-current')).toBe('page');
  });

  it('nav_08 playback survives screen change', async () => {
    await openPage();
    await clickPlay();
    audioCalls.length = 0;

    openScreen('grooves');
    openScreen('stadium');
    openScreen('editor');

    expect(audioCalls).toEqual([]);
    expect(byId('btn-play').classList.contains('playing')).toBe(true);
    await clickPlay();
  });

  const cards = () => [...document.querySelectorAll<HTMLElement>('.song-card')];
  const genreTab = (name: string) => [...document.querySelectorAll<HTMLElement>('.genre-tab')].find(tab => tab.innerText === name)!;

  it('grv_01 tabs', async () => {
    await openPage();
    expect([...document.querySelectorAll<HTMLElement>('#grooves-view .genre-tab')].map(tab => tab.innerText))
      .toEqual(['All', 'Rock', 'Metal', 'Metalcore', 'Blues']);
  });

  it('grv_02 all shows fourteen', async () => {
    await openPage();
    openScreen('grooves');
    expect(genreTab('All').getAttribute('aria-pressed')).toBe('true');
    expect(cards()).toHaveLength(14);
  });

  it('grv_03 genre counts', async () => {
    await openPage();
    const shown = (name: string) => {
      genreTab(name).click();
      expect(genreTab(name).getAttribute('aria-pressed')).toBe('true');
      return cards().map(card => card.querySelector('.song-artist')?.textContent);
    };
    expect(shown('Rock')).toEqual(['AC/DC', 'AC/DC']);
    expect(shown('Metal')).toHaveLength(5);
    expect(new Set(shown('Metal'))).toEqual(new Set(['Iron Maiden', 'Metallica']));
    expect(new Set(shown('Metalcore'))).toEqual(new Set(['Bullet for My Valentine']));
    expect(shown('Metalcore')).toHaveLength(3);
    expect(shown('Blues')).toHaveLength(4);
    expect(new Set(shown('Blues'))).toEqual(new Set(['Eric Clapton', 'Cream (Eric Clapton)', 'B.B. King']));
    expect(shown('All')).toHaveLength(14);
  });

  it('grv_04 card fields', async () => {
    await openPage();
    const card = cards()[0];
    const field = (name: string) => card.querySelector(`.song-${name}`)?.textContent;
    expect([field('title'), field('artist'), field('section'), field('bpm'), field('meter')])
      .toEqual(['Back in Black', 'AC/DC', 'Verse', '94 BPM', '4/4']);
  });

  it('song_07 songs group', async () => {
    await openPage();
    const group = byId('group-songs') as unknown as HTMLOptGroupElement;
    expect((group as any).label).toBe('Songs');
    expect(group.children).toHaveLength(14);

    await selectPreset('song:song_enter_sandman');
    expect(byId('pattern-name').textContent).toBe('PAT: Enter Sandman');
    expect(byId('preset-selector').value).toBe('song:song_enter_sandman');

    await pressPlay('Cocaine'); // A card moves the selector too
    expect(byId('preset-selector').value).toBe('song:song_cocaine');
    await clickPlay();
  });

  it('song_08 save leaves catalog', async () => {
    const stores = await openPage();
    const { SONGS } = await import('./songs');
    const original = structuredClone(SONGS);
    await selectPreset('song:song_battery');
    cell(8, 0).click();
    byId('preset-name').value = 'My Battery';
    byId<HTMLButtonElement>('btn-save').click();
    await flush();

    const saved = [...stores.presets.values()].find(preset => preset.name === 'My Battery');
    expect(saved.id).toMatch(/^user_/);
    expect(saved.gridData[8][0]).toBe(1);
    expect(saved.bpm).toBe(194);
    expect(SONGS).toEqual(original);
    expect(byId('preset-selector').value).toBe(`user:${saved.id}`);
  });

  const songButton = (title: string, selector: string) =>
    cards().find(card => card.querySelector('.song-title')?.textContent === title)!.querySelector<HTMLElement>(selector)!;
  const pressPlay = async (title: string) => {
    songButton(title, '.song-play').click();
    await flush();
  };

  it('grv_05 play stays on screen', async () => {
    await openPage();
    openScreen('grooves');
    await pressPlay('Enter Sandman');

    expect(byId('pattern-name').textContent).toBe('PAT: Enter Sandman');
    expect(calls('start')).toHaveLength(1);
    expect(byId('btn-play').classList.contains('playing')).toBe(true);
    expect(shownScreens()).toEqual(['grooves-view']);
    await clickPlay();
  });

  it('grv_06 playing mark', async () => {
    await openPage();
    expect(songButton('Battery', '.song-play').textContent).toBe('▶');
    await pressPlay('Battery');

    expect(songButton('Battery', '.song-play').textContent).toBe('■');
    expect(songButton('Cocaine', '.song-play').textContent).toBe('▶');

    genreTab('Metal').click(); // A redraw keeps the mark
    expect(songButton('Battery', '.song-play').textContent).toBe('■');

    await clickPlay(); // Stopping from the Editor clears it too
    expect(songButton('Battery', '.song-play').textContent).toBe('▶');
  });

  it('grv_07 stop keeps song', async () => {
    await openPage();
    await pressPlay('Cocaine');
    await pressPlay('Cocaine');

    expect(calls('stop')).toHaveLength(1);
    expect(byId('btn-play').classList.contains('playing')).toBe(false);
    expect(songButton('Cocaine', '.song-play').textContent).toBe('▶');
    expect(byId('pattern-name').textContent).toBe('PAT: Cocaine');
  });

  it('grv_08 switch during playback', async () => {
    await openPage();
    await pressPlay('Back in Black');
    await pressPlay('Master of Puppets');

    expect(calls('start')).toHaveLength(1);
    expect(calls('stop')).toHaveLength(0);
    expect(lastCall('setBpm')).toEqual([212]);
    expect(songButton('Master of Puppets', '.song-play').textContent).toBe('■');
    expect(songButton('Back in Black', '.song-play').textContent).toBe('▶');
    await clickPlay();
  });

  it('grv_08 switch while the kit still loads', async () => {
    await openPage();
    let kitReady = () => {};
    mockInit.mockImplementationOnce(() => new Promise<void>(resolve => { kitReady = resolve; }));

    await pressPlay('Back in Black');
    await pressPlay('Battery');
    kitReady();
    await flush();

    expect(calls('start')).toHaveLength(1);
    expect(calls('stop')).toHaveLength(0);
    expect(byId('pattern-name').textContent).toBe('PAT: Battery');
    expect(songButton('Battery', '.song-play').textContent).toBe('■');
    await clickPlay();
  });

  it('grv_11 asks before replacing edits', async () => {
    const asked = vi.fn(() => true);
    vi.stubGlobal('confirm', asked);
    await openPage();
    await pressPlay('Battery');
    await pressPlay('Battery');
    expect(asked).not.toHaveBeenCalled(); // Nothing was edited yet

    cell(1, 1).click();
    await pressPlay('Cocaine');
    expect(asked).toHaveBeenCalledOnce();
    expect(byId('pattern-name').textContent).toBe('PAT: Cocaine');

    cell(1, 1).click();
    await selectPreset('song:song_enter_sandman'); // The preset selector loads songs too
    expect(asked).toHaveBeenCalledTimes(2);
    expect(byId('pattern-name').textContent).toBe('PAT: Enter Sandman');
    await clickPlay();
  });

  it('grv_12 decline changes nothing', async () => {
    vi.stubGlobal('confirm', vi.fn(() => false));
    await openPage();
    await pressPlay('Battery');
    openScreen('editor');
    cell(8, 1).click();
    openScreen('grooves');
    audioCalls.length = 0;

    await pressPlay('Cocaine');

    expect(byId('pattern-name').textContent).toBe('PAT: Battery');
    expect(cell(8, 1).classList.contains('active')).toBe(true);
    expect(audioCalls).toEqual([]);
    expect(byId('btn-play').classList.contains('playing')).toBe(true);
    expect(shownScreens()).toEqual(['grooves-view']);

    await selectPreset('song:song_cocaine'); // Declined in the preset selector as well
    expect(byId('pattern-name').textContent).toBe('PAT: Battery');
    expect(byId('preset-selector').value).toBe('song:song_battery');
    expect(cell(8, 1).classList.contains('active')).toBe(true);
    await clickPlay();
  });

  it('song_05 load replaces everything', async () => {
    await openPage();
    await selectPreset('factory:3_4'); // Another meter, so the song must replace it
    expect(byId('time-sig-num').value).toBe('3');
    byId('trainer-enable').checked = true;
    byId('trainer-enable').dispatchEvent(new Event('change'));
    cell(7, 3).click();
    vi.stubGlobal('confirm', vi.fn(() => true));

    await pressPlay('Don\'t Need You');

    expect(byId('bpm-slider').value).toBe('154');
    expect(byId('time-sig-num').value).toBe('4');
    expect(byId('time-sig-den').value).toBe('4');
    expect(lastCall('setMeasureLength')).toEqual([16]);
    expect(byId('trainer-enable').checked).toBe(false);
    expect(cell(7, 3).classList.contains('active')).toBe(false);
    expect(cell(1, 3).classList.contains('active')).toBe(true); // The chorus kick
    await clickPlay();
  });

  it('song_06 card matches tempo bus', async () => {
    await openPage();
    await pressPlay('The Trooper');

    expect(songButton('The Trooper', '.song-bpm').textContent).toBe(`${byId('bpm-number').innerText} BPM`);
    expect(byId('bpm-number').innerText).toBe('162');
    await clickPlay();
  });

  it('edt_06 an old preset loads through the page', async () => {
    const old = storedPreset();
    old.gridData[2][1] = 7;
    await openPage([old]);
    await selectPreset('user:stored');

    expect(document.querySelectorAll('.step-cell')).toHaveLength(13 * 16);
    expect(document.querySelectorAll('.step-cell[data-track="8"].active')).toHaveLength(0);
    expect(cell(2, 1).classList.contains('active')).toBe(true); // An unknown value reads as normal

    await clickPlay();
    const snare = [...calls('updateGrid').filter(([trackId]) => trackId === 2).at(-1)![1]];
    expect(snare[1]).toBe(1);
    expect(calls('updateGrid').map(([trackId]) => trackId)).toContain(10);
    await clickPlay();
  });

  it('edge_02 load keeps the mix', async () => {
    await openPage();
    byId<HTMLButtonElement>('solo-2').click();
    await pressPlay('Cocaine');

    expect(byId('solo-2').getAttribute('aria-pressed')).toBe('true');
    expect(cell(1, 0).classList.contains('silenced')).toBe(true);
    const kick = [...calls('updateGrid').filter(([trackId]) => trackId === 1).at(-1)![1]];
    expect(kick.every(value => value === 0)).toBe(true);
    await clickPlay();
  });

  it('grv_09 open in editor', async () => {
    await openPage();
    openScreen('grooves');
    songButton('Battery', '.song-open').click();
    await flush();

    expect(shownScreens()).toEqual(['editor-view']);
    expect(byId('nav-editor').getAttribute('aria-current')).toBe('page');
    expect(byId('pattern-name').textContent).toBe('PAT: Battery');
    expect(byId('btn-play').classList.contains('playing')).toBe(false);
  });

  it('grv_10 loaded song keeps edits', async () => {
    const asked = vi.fn(() => false);
    vi.stubGlobal('confirm', asked);
    await openPage();
    await pressPlay('Battery');
    cell(8, 1).click();
    openScreen('grooves');

    songButton('Battery', '.song-open').click();
    await flush();
    expect(shownScreens()).toEqual(['editor-view']);
    expect(cell(8, 1).classList.contains('active')).toBe(true);

    await pressPlay('Battery');
    await pressPlay('Battery');
    expect(cell(8, 1).classList.contains('active')).toBe(true);
    expect(asked).not.toHaveBeenCalled();
    await clickPlay();
  });

  it('grv_12 decline keeps the screen on open in editor', async () => {
    vi.stubGlobal('confirm', vi.fn(() => false));
    await openPage();
    cell(1, 1).click();
    openScreen('grooves');

    songButton('Battery', '.song-open').click();
    await flush();
    expect(shownScreens()).toEqual(['grooves-view']);
    expect(byId('pattern-name').textContent).not.toContain('Battery');
  });
});

describe('Song Bars', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    delete (globalThis as any).indexedDB;
    localStorage.removeItem('metrorig_view_mode');
    mockGsap.fromTo.mockClear();
  });

  const openSong = async (id = 'song_battery') => {
    const stores = await openPage();
    await selectPreset(`song:${id}`);
    return stores;
  };

  const barButtons = () => [...document.querySelectorAll<HTMLButtonElement>('#bar-selector .bar-btn')];

  const pressBar = (bar: number) => barButtons()[bar - 1].click();
  const pressedBars = () => barButtons().filter(button => button.getAttribute('aria-pressed') === 'true').map(button => button.textContent);

  const cell = (trackId: number, step: number) =>
    document.querySelectorAll<HTMLElement>(`.step-cell[data-track="${trackId}"]`)[step];

  // What the grid shows for a track, as step values
  const shown = (trackId: number) => [...document.querySelectorAll<HTMLElement>(`.step-cell[data-track="${trackId}"]`)].map(element => {
    if (element.classList.contains('active')) return 1;
    if (element.classList.contains('accent')) return 2;
    return element.classList.contains('ghost') ? 3 : 0;
  });

  const battery = SONGS.find(song => song.id === 'song_battery')!;
  const barOf = (trackId: number, bar: number, song = battery) => (song.gridData[trackId] ?? new Array(64).fill(0)).slice((bar - 1) * 16, bar * 16);
  const backInBlack = SONGS.find(song => song.id === 'song_back_in_black')!; // Bar 4 is a fill

  it('edit_01 selector on four bars', async () => {
    await openSong();
    expect(byId('bar-selector').hidden).toBe(false);
    expect(barButtons().map(button => button.textContent)).toEqual(['1', '2', '3', '4']);
  });

  it('edit_02 no selector on one bar', async () => {
    await openSong();
    await selectPreset('factory:default');
    expect(byId('bar-selector').hidden).toBe(true);
  });

  it('edit_03 press shows the bar', async () => {
    await openSong();
    for (const bar of [3, 2, 4, 1]) {
      pressBar(bar);
      expect(pressedBars()).toEqual([String(bar)]);
      expect(shown(1)).toHaveLength(16);
      for (const trackId of [1, 2, 3, 4, 5, 7]) expect(shown(trackId), `track ${trackId} bar ${bar}`).toEqual(barOf(trackId, bar));
    }
  });

  it('edit_04 song loads on bar one', async () => {
    await openSong();
    pressBar(3);
    await selectPreset('song:song_cocaine');
    expect(pressedBars()).toEqual(['1']);
    await selectPreset('song:song_battery');
    expect(shown(1)).toEqual(barOf(1, 1));
  });

  it('edit_04 a song loaded during playback starts on bar one', async () => {
    await openSong();
    await clickPlay();
    tick({ currentBpm: 194, beatIndex: 32 });
    expect(pressedBars()).toEqual(['3']);

    await selectPreset('song:song_cocaine');
    expect(pressedBars()).toEqual(['1']);
    expect(calls('restartPattern')).toHaveLength(1);
    expect(calls('start')).toHaveLength(1); // The pulse goes on
    expect(calls('stop')).toHaveLength(0);
    // After the new song's grids, or the old steps would play on bar 1
    const methods = audioCalls.map(call => call.method);
    expect(methods.lastIndexOf('restartPattern')).toBeGreaterThan(methods.lastIndexOf('updateGrid'));
    await clickPlay();
  });

  it('edit_04 a stopped load and a 1-bar load leave the engine alone', async () => {
    await openSong();
    await selectPreset('song:song_cocaine');
    expect(calls('restartPattern')).toHaveLength(0);

    await clickPlay();
    await selectPreset('factory:default');
    expect(calls('restartPattern')).toHaveLength(0);
    await clickPlay();
  });

  it('edit_07 cell changes one bar', async () => {
    await openSong();
    await clickPlay();
    pressBar(3);
    const before = shown(10);
    cell(10, 5).click();
    expect(shown(10)).toEqual(before.map((value, step) => (step === 5 ? 1 : value)));

    for (const bar of [1, 2, 4]) {
      pressBar(bar);
      expect(shown(10), `bar ${bar}`).toEqual(barOf(10, bar));
    }
    const sent = [...calls('updateGrid').filter(([trackId]) => trackId === 10).at(-1)![1]];
    expect(sent).toEqual((battery.gridData[10] ?? new Array(64).fill(0)).map((value, step) => (step === 37 ? 1 : value)));
    await clickPlay();
  });

  it('edit_08 figure stays in the bar', async () => {
    await openSong();
    [...document.querySelectorAll<HTMLElement>('.figure-btn')].find(button => button.innerText.startsWith('16ths'))!.click();
    pressBar(2);
    cell(10, 4).click();
    expect(shown(10)).toEqual(barOf(10, 2).map((value, step) => (step >= 4 && step < 8 ? 1 : value)));

    for (const bar of [1, 3, 4]) {
      pressBar(bar);
      expect(shown(10), `bar ${bar}`).toEqual(barOf(10, bar));
    }
  });

  it('edit_05 follows the bar in play', async () => {
    await openSong();
    await clickPlay();
    for (const [beatIndex, bar] of [[0, 1], [15, 1], [16, 2], [32, 3], [48, 4], [63, 4], [0, 1]]) {
      tick({ currentBpm: 194, beatIndex });
      expect(pressedBars(), `step ${beatIndex}`).toEqual([String(bar)]);
      expect(shown(1), `step ${beatIndex}`).toEqual(barOf(1, bar));
    }
    await clickPlay();
  });

  it('edit_06 press during playback', async () => {
    await openSong();
    await clickPlay();
    tick({ currentBpm: 194, beatIndex: 0 });

    const sent = audioCalls.length;
    pressBar(3);
    expect(audioCalls.length).toBe(sent); // The sound does not change
    expect(shown(1)).toEqual(barOf(1, 3));

    tick({ currentBpm: 194, beatIndex: 1 });
    tick({ currentBpm: 194, beatIndex: 15 });
    expect(pressedBars()).toEqual(['3']); // It holds until the next bar starts

    tick({ currentBpm: 194, beatIndex: 16 });
    expect(pressedBars()).toEqual(['2']);
    expect(shown(1)).toEqual(barOf(1, 2));
    await clickPlay();
  });

  it('edit_05 a bar pressed while stopped gives way to Play', async () => {
    await openSong();
    pressBar(3);
    await clickPlay();
    expect(pressedBars()).toEqual(['1']);
    tick({ currentBpm: 194, beatIndex: 0 });
    tick({ currentBpm: 194, beatIndex: 5 });
    expect(pressedBars()).toEqual(['1']);
    expect(shown(1)).toEqual(barOf(1, 1));
    await clickPlay();
  });

  it('meter_01 the same time signature changes nothing', async () => {
    await openSong();
    const confirmSpy = vi.fn();
    vi.stubGlobal('confirm', confirmSpy);
    byId('time-sig-num').value = '04';
    byId('time-sig-num').dispatchEvent(new Event('change'));

    expect(confirmSpy).not.toHaveBeenCalled();
    expect(byId('pattern-steps').textContent).toBe('STEPS: 64/128');
    expect(byId('bar-selector').hidden).toBe(false);
  });

  it('a tick of the old pattern draws nothing after a load', async () => {
    await openSong();
    await clickPlay();
    tick({ currentBpm: 194, beatIndex: 32 });
    await selectPreset('factory:default');
    const click = shown(0);

    tick({ currentBpm: 194, beatIndex: 33 });
    expect(shown(0)).toEqual(click);
    expect(click.filter(Boolean)).toHaveLength(4);
    await clickPlay();
  });

  it('a tick waiting when the time signature changes draws nothing', async () => {
    await openSong();
    await clickPlay();
    vi.stubGlobal('confirm', vi.fn(() => true));
    vi.useFakeTimers();
    mockVisualDelay = 100;
    tick({ currentBpm: 194, beatIndex: 40 });
    stepNumeratorDown();
    vi.advanceTimersByTime(150);
    vi.useRealTimers();

    expect(shown(1)).toEqual(barOf(1, 1).slice(0, 12));
    await clickPlay();
  });

  it('the clock leaves the old bar when a preset loads during playback', async () => {
    await openSong();
    await clickPlay();
    tick({ currentBpm: 194, beatIndex: 48 });
    await selectPreset('song:song_back_in_black');
    expectClockShows(1, backInBlack);
    await clickPlay();
  });

  it('the clock leaves the old bar when the time signature changes during playback', async () => {
    await openSong('song_back_in_black');
    await clickPlay();
    tick({ currentBpm: 94, beatIndex: 48 });
    vi.stubGlobal('confirm', vi.fn(() => true));
    stepNumeratorDown();

    const kick = barOf(1, 1, backInBlack).slice(0, 12).map(value => value > 0);
    expect(ringHits(1)).toEqual(kick);
    await clickPlay();
  });

  it('edit_11 stop returns to bar one', async () => {
    await openSong();
    await clickPlay();
    tick({ currentBpm: 194, beatIndex: 40 });
    expect(pressedBars()).toEqual(['3']);
    await clickPlay();
    expect(pressedBars()).toEqual(['1']);
    expect(shown(1)).toEqual(barOf(1, 1));
  });

  it('edit_09 groove stays in the bar', async () => {
    await openSong();
    pressBar(2);
    const click = shown(0);
    const grooves = byId<HTMLSelectElement>('groove-selector');
    grooves.value = 'factory:rock';
    grooves.dispatchEvent(new Event('change'));

    const rock = shown(1);
    expect(rock).not.toEqual(barOf(1, 2));
    expect(rock.filter(Boolean).length).toBeGreaterThan(0);
    expect(shown(0)).toEqual(click); // Click belongs to the meter
    for (const bar of [1, 3, 4]) {
      pressBar(bar);
      expect(shown(1), `bar ${bar}`).toEqual(barOf(1, bar));
      expect(shown(7), `bar ${bar}`).toEqual(barOf(7, bar));
    }
    pressBar(2);
    expect(shown(1)).toEqual(rock);
    expect(shown(7)).toEqual(new Array(16).fill(0)); // A groove clears the other tracks of its bar
  });

  it('edit_10 save groove takes the bar', async () => {
    const stores = await openSong();
    pressBar(4);
    vi.stubGlobal('prompt', vi.fn(() => 'Battery fill'));
    vi.stubGlobal('alert', vi.fn());
    byId<HTMLButtonElement>('btn-save-groove').click();
    await flush();

    const saved = [...stores.grooves.values()].find(groove => groove.name === 'Battery fill');
    expect(saved.measureLength).toBe(16);
    expect(saved.gridData[1]).toEqual(barOf(1, 4));
    expect(saved.gridData[2]).toEqual(barOf(2, 4));
    expect(saved.gridData[0]).toBeUndefined();
  });

  const stepNumeratorDown = () => byId<HTMLButtonElement>('time-sig-num-down').click();

  it('meter_01 asks first', async () => {
    await openSong();
    const confirmSpy = vi.fn(() => {
      // Nothing has changed when the question appears
      expect(byId('pattern-steps').textContent).toBe('STEPS: 64/128');
      return false;
    });
    vi.stubGlobal('confirm', confirmSpy);

    stepNumeratorDown();
    expect(confirmSpy).toHaveBeenCalledTimes(1);
    byId<HTMLButtonElement>('time-sig-den-up').click();
    expect(confirmSpy).toHaveBeenCalledTimes(2);
    byId('time-sig-num').value = '3';
    byId('time-sig-num').dispatchEvent(new Event('change'));
    expect(confirmSpy).toHaveBeenCalledTimes(3);
  });

  it('meter_02 accept keeps bar one', async () => {
    await openSong();
    await clickPlay();
    pressBar(3);
    vi.stubGlobal('confirm', vi.fn(() => true));
    stepNumeratorDown();

    expect(byId('pattern-steps').textContent).toBe('STEPS: 12/128');
    expect(shown(1)).toEqual(barOf(1, 1).slice(0, 12));
    expect(lastCall('setBars')).toEqual([1]);
    expect(lastCall('setMeasureLength')).toEqual([12]);
    expect([...calls('updateGrid').filter(([trackId]) => trackId === 1).at(-1)![1]]).toEqual(barOf(1, 1).slice(0, 12));
    await clickPlay();
  });

  it('meter_02 keeps bar one whatever bar is on screen', async () => {
    await openSong('song_back_in_black');
    pressBar(4);
    expect(barOf(1, 4, backInBlack).slice(0, 12)).not.toEqual(barOf(1, 1, backInBlack).slice(0, 12));
    vi.stubGlobal('confirm', vi.fn(() => true));
    stepNumeratorDown();

    for (const trackId of [1, 2, 3, 4, 7]) expect(shown(trackId), `track ${trackId}`).toEqual(barOf(trackId, 1, backInBlack).slice(0, 12));
  });

  it('meter_02 a longer bar still starts from bar one', async () => {
    await openSong();
    vi.stubGlobal('confirm', vi.fn(() => true));
    byId<HTMLButtonElement>('time-sig-num-up').click();

    expect(byId('pattern-steps').textContent).toBe('STEPS: 20/128');
    expect(shown(1)).toEqual([...barOf(1, 1), 0, 0, 0, 0]);
  });

  it('meter_03 decline changes nothing', async () => {
    await openSong();
    vi.stubGlobal('confirm', vi.fn(() => false));
    stepNumeratorDown();

    expect(byId('time-sig-num').value).toBe('4');
    expect(byId('time-sig-den').value).toBe('4');
    expect(byId('pattern-steps').textContent).toBe('STEPS: 64/128');
    expect(byId('bar-selector').hidden).toBe(false);
    pressBar(4);
    expect(shown(1)).toEqual(barOf(1, 4));
  });

  it('meter_04 selector hides', async () => {
    await openSong();
    vi.stubGlobal('confirm', vi.fn(() => true));
    stepNumeratorDown();
    expect(byId('bar-selector').hidden).toBe(true);
  });

  it('count_06 limit of one bar', async () => {
    await openSong();
    const alertSpy = vi.fn();
    const confirmSpy = vi.fn();
    vi.stubGlobal('alert', alertSpy);
    vi.stubGlobal('confirm', confirmSpy);
    byId('time-sig-num').value = '10';
    byId('time-sig-num').dispatchEvent(new Event('change'));

    expect(alertSpy).toHaveBeenCalledWith('Time signature exceeds the maximum limit of 32 steps!');
    expect(confirmSpy).not.toHaveBeenCalled();
    expect(byId('time-sig-num').value).toBe('4');
    expect(byId('pattern-steps').textContent).toBe('STEPS: 64/128');
  });

  it('edge_01 load during bar three', async () => {
    await openSong();
    await clickPlay();
    tick({ currentBpm: 194, beatIndex: 0 });
    tick({ currentBpm: 194, beatIndex: 16 });
    tick({ currentBpm: 194, beatIndex: 32 });
    await selectPreset('factory:default');
    expect(lastCall('setBars')).toEqual([1]);
    expect(byId('bar-selector').hidden).toBe(true);

    tick({ currentBpm: 120, beatIndex: 0 });
    expect(byId('pattern-pos-value').textContent).toBe('BAR 04 · STEP 01');
    await clickPlay();
  });

  it('edge_02 edits in any bar ask', async () => {
    await openSong();
    pressBar(4);
    cell(10, 2).click();
    const confirmSpy = vi.fn(() => false);
    vi.stubGlobal('confirm', confirmSpy);

    byId<HTMLButtonElement>('nav-grooves').click();
    const card = [...document.querySelectorAll<HTMLElement>('.song-card')].find(element => element.textContent!.includes('Cocaine'))!;
    card.querySelector<HTMLButtonElement>('.song-open')!.click();
    await flush();

    expect(confirmSpy).toHaveBeenCalledTimes(1);
    expect(byId('pattern-name').textContent).toBe('PAT: Battery');
  });

  // The steps each ring lights, against what the song holds in that bar
  const ringHits = (ring: number) => [...document.querySelectorAll(`.clock-slice[data-track="${ring}"]`)].map(slice => slice.classList.contains('on'));
  const expectClockShows = (bar: number, song = battery) => {
    STADIUM_GROUPS.forEach(({ trackIds }, ring) => {
      const expected = Array.from({ length: 16 }, (_, step) => trackIds.some(trackId => barOf(trackId, bar, song)[step] > 0));
      if (ring > 0) expect(ringHits(ring), `ring ${ring} bar ${bar}`).toEqual(expected);
    });
  };

  it('clock_01 sixteen slices', async () => {
    await openSong();
    STADIUM_GROUPS.forEach((_, ring) => expect(ringHits(ring)).toHaveLength(16));
    expect([...document.querySelectorAll('.clock-label')].map(label => label.textContent)).toEqual(['1', '2', '3', '4']);
  });

  it('clock_02 bar in play', async () => {
    await openSong();
    await clickPlay();
    for (const [beatIndex, bar] of [[0, 1], [16, 2], [32, 3], [48, 4], [0, 1]]) {
      tick({ currentBpm: 194, beatIndex });
      expectClockShows(bar);
    }
    await clickPlay();
  });

  it('clock_03 changes on the first step', async () => {
    await openSong();
    await selectPreset('song:song_back_in_black');
    await clickPlay();
    expect(barOf(1, 3, backInBlack)).not.toEqual(barOf(1, 4, backInBlack));
    tick({ currentBpm: 94, beatIndex: 47 });
    expectClockShows(3, backInBlack);
    tick({ currentBpm: 94, beatIndex: 48 });
    expectClockShows(4, backInBlack);
    await clickPlay();
  });

  it('clock_03 waits for the sound', async () => {
    await openSong();
    await clickPlay();
    vi.useFakeTimers();
    mockVisualDelay = 100;
    tick({ currentBpm: 194, beatIndex: 47 });
    vi.advanceTimersByTime(150);
    tick({ currentBpm: 194, beatIndex: 48 });
    expectClockShows(3);
    vi.advanceTimersByTime(150);
    expectClockShows(4);
    vi.useRealTimers();
    await clickPlay();
  });

  it('clock_04 stopped shows bar one', async () => {
    await openSong();
    pressBar(3);
    expectClockShows(1);

    await clickPlay();
    tick({ currentBpm: 194, beatIndex: 40 });
    expectClockShows(3);
    await clickPlay();
    expectClockShows(1);
  });

  it('clock_04 a press during playback leaves the clock', async () => {
    await openSong();
    await clickPlay();
    tick({ currentBpm: 194, beatIndex: 16 });
    pressBar(4);
    expectClockShows(2);
    await clickPlay();
  });

  it('clock_05 orb pulses', async () => {
    await openSong();
    await clickPlay();
    mockGsap.fromTo.mockClear();
    tick({ currentBpm: 194, beatIndex: 53, activeTrackIds: [2] });
    expect(mockGsap.fromTo.mock.calls.some(call => call[0] === byId('orb-2'))).toBe(true);
    expect(mockGsap.fromTo.mock.calls.some(call => call[0] === byId('orb-1'))).toBe(false);
    await clickPlay();
  });

  it('the page holds a hidden selector of 4 bars', async () => {
    await openPage();
    expect(barButtons().map(button => button.textContent)).toEqual(['1', '2', '3', '4']);
    expect(byId('bar-selector').hidden).toBe(true);
  });

  it('sends the bar count with every pattern', async () => {
    await openSong();
    await clickPlay();
    expect(lastCall('setMeasureLength')).toEqual([16]);
    expect(lastCall('setBars')).toEqual([4]);
    expect(calls('updateGrid').find(([trackId]) => trackId === 1)![1]).toHaveLength(64);

    await selectPreset('factory:default');
    expect(lastCall('setBars')).toEqual([1]);
    await clickPlay();
  });

  it('count_03 position by bar', async () => {
    await openSong();
    await clickPlay();

    tick({ currentBpm: 194, beatIndex: 0 });
    expect(byId('pattern-pos-value').textContent).toBe('BAR 01 · STEP 01');
    tick({ currentBpm: 194, beatIndex: 15 });
    expect(byId('pattern-pos-value').textContent).toBe('BAR 01 · STEP 16');
    tick({ currentBpm: 194, beatIndex: 16 });
    expect(byId('pattern-pos-value').textContent).toBe('BAR 02 · STEP 01');
    tick({ currentBpm: 194, beatIndex: 37 });
    expect(byId('pattern-pos-value').textContent).toBe('BAR 02 · STEP 06');
    tick({ currentBpm: 194, beatIndex: 48 });
    tick({ currentBpm: 194, beatIndex: 0 }); // The pattern wraps, the count goes on
    expect(byId('pattern-pos-value').textContent).toBe('BAR 04 · STEP 01');
    await clickPlay();
  });

  it('count_04 steps over the limit', async () => {
    await openPage();
    expect(byId('pattern-steps').textContent).toBe('STEPS: 16/128');
    await selectPreset('song:song_battery');
    expect(byId('pattern-steps').textContent).toBe('STEPS: 64/128');
  });

  it('bars_07 saved song keeps four bars', async () => {
    const stores = await openSong();
    byId('preset-name').value = 'My Battery';
    byId<HTMLButtonElement>('btn-save').click();
    await flush();

    const saved = [...stores.presets.values()].find((preset: any) => preset.name === 'My Battery') as any;
    expect(saved.bars).toBe(4);
    for (const trackId of [1, 2, 3, 4, 5, 7]) expect(saved.gridData[trackId], `track ${trackId}`).toEqual(battery.gridData[trackId] ?? new Array(64).fill(0));

    await selectPreset('factory:default');
    await selectPreset(`user:${saved.id}`);
    expect(byId('pattern-steps').textContent).toBe('STEPS: 64/128');
    expect(byId('pattern-name').textContent).toBe('PAT: My Battery');
    for (const bar of [1, 2, 3, 4]) {
      pressBar(bar);
      for (const trackId of [1, 2, 3]) expect(shown(trackId), `track ${trackId} bar ${bar}`).toEqual(barOf(trackId, bar));
    }
  });
});

describe('House Kit', () => {
  const taken = () => mockLoadTake.mock.calls.map(([trackId, dynamic, take, url, trim]) => ({ trackId, dynamic, take, url, trim }));

  it('loads every take of each bank at its trim, and no bank piece as a single sample', async () => {
    mockLoadTake.mockReset();
    mockLoadTake.mockResolvedValue(undefined);
    mockLoadSample.mockClear();
    await openPage();
    await clickPlay();

    const loads = taken();
    expect(loads).toHaveLength(54);
    const bankIds = [1, 2, 9, 10, 11, 12];
    bankIds.forEach(trackId => {
      const own = loads.filter(load => load.trackId === trackId);
      expect(own, `track ${trackId}`).toHaveLength(9);
      expect(new Set(own.map(load => load.url)).size).toBe(9);
      const trim = TRACKS.find(track => track.id === trackId)!.bank!.trim;
      expect(trim).toBeGreaterThan(0);
      own.forEach(load => expect(load.trim).toBe(trim));
    });
    expect(loads.find(load => load.trackId === 2 && load.dynamic === 2 && load.take === 1)!.url).toBe('/kit/house/snare/crack-2.wav');
    expect(loads.find(load => load.trackId === 12 && load.dynamic === 1 && load.take === 0)!.url).toBe('/kit/house/tom-14/med-1.wav');
    expect(mockLoadSample.mock.calls.map(([id]) => id).filter(id => bankIds.includes(id))).toEqual([]);
    await clickPlay();
  });

  it('hk_12 logs a failed take', async () => {
    const failure = new Error('404');
    mockLoadTake.mockReset();
    mockLoadTake.mockImplementation((trackId: number, dynamic: number, take: number) =>
      trackId === 2 && dynamic === 1 && take === 1 ? Promise.reject(failure) : Promise.resolve());
    const logged = vi.spyOn(console, 'error').mockImplementation(() => {});
    await openPage();
    await clickPlay();

    expect(logged).toHaveBeenCalledWith('Failed to load /kit/house/snare/hard-2.wav:', failure);
    expect(logged.mock.calls.filter(([message]) => String(message).startsWith('Failed to load'))).toHaveLength(1);
    expect(taken()).toHaveLength(54); // The other 53 takes were still requested
    expect(calls('start')).toHaveLength(1);
    expect(byId('btn-play').classList.contains('playing')).toBe(true);
    await clickPlay();
    logged.mockRestore();
    mockLoadTake.mockReset();
    mockLoadTake.mockResolvedValue(undefined);
  });

  const cell = (trackId: number, step: number) =>
    document.querySelectorAll<HTMLElement>(`.step-cell[data-track="${trackId}"]`)[step];
  const dynamicOf = (trackId: number, step: number) =>
    ['active', 'accent', 'ghost'].filter(name => cell(trackId, step).classList.contains(name)).join();
  const sentTo = (trackId: number) => [...calls('updateGrid').filter(call => call[0] === trackId).at(-1)![1]];
  const orbPulsed = (group: number) => mockGsap.fromTo.mock.calls.some(call => call[0] === byId(`orb-${group}`));
  const NEW_TOMS = [11, 12];

  it('hk_15 rows follow the track order', async () => {
    await openPage();
    const rowOf = (element: HTMLElement) => Number(element.style.gridRow);
    const labels = [...document.querySelectorAll<HTMLElement>('.track-label')].sort((a, b) => rowOf(a) - rowOf(b));

    expect(labels.map(label => label.innerText)).toEqual([
      'Click', 'Kick', 'Snare', 'Hi-hat', 'Open Hat', 'Ride', 'Ride Bell', 'Crash', 'China',
      'High Tom', 'Mid Tom', 'Low Tom', 'Floor Tom',
    ]);
    expect(labels.map(rowOf)).toEqual([2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14]);
    labels.forEach(label => {
      const cells = document.querySelectorAll<HTMLElement>(`.step-cell[data-track="${label.dataset.track}"]`);
      expect(cells).toHaveLength(16);
      cells.forEach(step => expect(rowOf(step), label.innerText).toBe(rowOf(label)));
    });
  });

  it('hk_17 thirteen rows and cards', async () => {
    await openPage();

    expect(document.querySelectorAll('.track-label')).toHaveLength(13);
    expect(document.querySelectorAll('.track-mix-card')).toHaveLength(13);
    expect(document.querySelectorAll('.step-cell')).toHaveLength(13 * 16);
    NEW_TOMS.forEach(trackId => {
      expect(document.querySelectorAll(`.step-cell[data-track="${trackId}"]`)).toHaveLength(16);
      expect(document.querySelector(`.track-mix-card[data-track="${trackId}"]`)).not.toBeNull();
    });
  });

  it('hk_18 new tom cells cycle and play', async () => {
    await openPage();

    for (const trackId of NEW_TOMS) {
      const seen = [];
      for (let i = 0; i < 4; i++) {
        cell(trackId, 1).click();
        seen.push(dynamicOf(trackId, 1));
      }
      expect(seen, `track ${trackId}`).toEqual(['active', 'accent', 'ghost', '']);
    }

    cell(11, 1).click(); // Normal
    cell(12, 2).click();
    cell(12, 2).click(); // Accent
    await clickPlay();
    expect(sentTo(11)[1]).toBe(1);
    expect(sentTo(12)[2]).toBe(2);
    await clickPlay();
  });

  it('hk_19 mute and solo the new toms', async () => {
    await openPage();
    cell(11, 0).click();
    cell(12, 0).click();
    await clickPlay();
    const silence = new Array(16).fill(0);
    expect(sentTo(11)[0]).toBe(1);

    byId<HTMLButtonElement>('mute-11').click();
    expect(sentTo(11)).toEqual(silence);
    expect(sentTo(12)[0]).toBe(1);
    expect(cell(11, 0).classList.contains('silenced')).toBe(true);
    byId<HTMLButtonElement>('mute-11').click();
    expect(sentTo(11)[0]).toBe(1);

    byId<HTMLButtonElement>('solo-12').click();
    expect(sentTo(12)[0]).toBe(1);
    expect(sentTo(11)).toEqual(silence);
    expect(cell(11, 0).classList.contains('silenced')).toBe(true);
    expect(cell(12, 0).classList.contains('silenced')).toBe(false);
    byId<HTMLButtonElement>('solo-12').click();

    byId<HTMLButtonElement>('mute-12').click();
    expect(sentTo(12)).toEqual(silence);
    expect(sentTo(11)[0]).toBe(1);
    expect(cell(12, 0).classList.contains('silenced')).toBe(true);
    byId<HTMLButtonElement>('mute-12').click();
    expect(sentTo(12)[0]).toBe(1);

    byId<HTMLButtonElement>('solo-11').click();
    expect(sentTo(11)[0]).toBe(1);
    expect(sentTo(12)).toEqual(silence);
    expect(cell(12, 0).classList.contains('silenced')).toBe(true);
    expect(cell(11, 0).classList.contains('silenced')).toBe(false);
    await clickPlay();
  });

  it('hk_21 new toms light the stadium group', async () => {
    await openPage();
    const ringOn = (step: number) => document.querySelectorAll(`.clock-slice[data-track="2"]`)[step].classList.contains('on');

    cell(11, 3).click();
    cell(12, 5).click();
    expect(ringOn(3)).toBe(true);
    expect(ringOn(5)).toBe(true);
    expect(ringOn(4)).toBe(false);

    await clickPlay();
    for (const trackId of NEW_TOMS) {
      mockGsap.fromTo.mockClear();
      tick({ currentBpm: 120, activeTrackIds: [trackId] });
      expect(orbPulsed(2), `track ${trackId}`).toBe(true);
      expect(orbPulsed(3)).toBe(false);
    }
    await clickPlay();
  });

  it('hk_31 footer credit', async () => {
    await openPage();
    const footer = document.querySelector('footer.status-bar')!;
    expect(footer.textContent).toContain('Kick, snare and toms: The House Kit by Better Mixes — thanks!');
    // The footer sits outside every screen, so it shows on all of them
    ['editor-view', 'stadium-view', 'grooves-view'].forEach(id => {
      expect(document.getElementById(id)!.contains(footer), id).toBe(false);
    });
    expect(footer.parentElement).toBe(document.getElementById('editor-view')!.parentElement);
  });

  it('hk_32 footer link', async () => {
    await openPage();
    const links = [...document.querySelectorAll<HTMLAnchorElement>('footer.status-bar a')];
    expect(links).toHaveLength(1);
    expect(links[0].textContent).toBe('Better Mixes');
    expect(links[0].getAttribute('href')).toBe('https://www.youtube.com/@BetterMixes');
    expect(links[0].target).toBe('_blank');
    expect(links[0].rel).toContain('noopener');
  });
});

describe('Improv', () => {
  beforeEach(() => {
    for (const mock of [mockInit, mockLoadSample, mockLoadTake]) {
      mock.mockReset();
      mock.mockResolvedValue(undefined);
    }
  });

  afterEach(() => {
    delete (globalThis as any).indexedDB;
    localStorage.removeItem('metrorig_view_mode');
  });

  const chordButton = (name: string) =>
    [...document.querySelectorAll<HTMLButtonElement>('#chord-grid button')].find(button => button.textContent === name)!;
  const clickChord = async (name: string) => {
    chordButton(name).click();
    await flush();
  };
  const openImprov = async () => {
    byId<HTMLButtonElement>('nav-improv').click();
    await flush();
  };
  const pressedChords = () =>
    [...document.querySelectorAll<HTMLButtonElement>('#chord-grid button[aria-pressed="true"]')].map(button => button.textContent);
  const shownChord = () => byId('pad-status').textContent;
  const notice = () => (byId('pad-notice').hidden ? null : byId('pad-notice').textContent);
  // Resolves the engine start by hand
  const holdEngine = () => {
    let release!: () => void;
    mockInit.mockImplementationOnce(() => new Promise<void>(resolve => { release = resolve; }));
    return () => release();
  };

  const shownScreens = () => ['editor-view', 'stadium-view', 'grooves-view', 'improv-view'].filter(id => !byId(id).classList.contains('hidden'));

  it('pad_30 link and title', async () => {
    await openPage();
    const links = [...document.querySelectorAll<HTMLButtonElement>('header nav button')];
    expect(links.map(link => link.textContent)).toEqual(['Editor', 'Stadium', 'Grooves', 'Improv']);
    expect(shownScreens()).toEqual(['editor-view']);

    links[3].click();

    expect(shownScreens()).toEqual(['improv-view']);
    expect(links[3].getAttribute('aria-current')).toBe('page');
    expect(document.querySelector('#improv-view h1')?.textContent).toBe('Improv · Chord Pads');
  });

  it('pad_57 saved screen opens Improv', async () => {
    await openPage();
    byId<HTMLButtonElement>('nav-improv').click();
    expect(localStorage.getItem('metrorig_view_mode')).toBe('improv');

    await openPage();

    expect(shownScreens()).toEqual(['improv-view']);
    expect(byId('nav-improv').getAttribute('aria-current')).toBe('page');
  });

  it('pad_15 chord does not wait for the kit', async () => {
    mockLoadTake.mockImplementation(() => new Promise<void>(() => {})); // The kit never finishes
    await openPage();
    await clickPlay();
    expect(mockLoadTake).toHaveBeenCalled();
    expect(byId('btn-play').classList.contains('playing')).toBe(false);

    await openImprov();
    await clickChord('C7M(9)');

    expect(calls('padPlay')).toEqual([[[48, 52, 55, 59, 62]]]);
    expect(shownChord()).toBe('C7M(9) · C E G B D');
    expect(pressedChords()).toEqual(['C7M(9)']);
    expect(byId('btn-play').classList.contains('playing')).toBe(false);
  });

  it('pad_15 Improv starts the engine and leaves the kit alone', async () => {
    await openPage();
    expect(mockInit).not.toHaveBeenCalled();

    await openImprov();
    await clickChord('Cm7');

    expect(mockInit).toHaveBeenCalledTimes(1);
    expect(mockLoadTake).not.toHaveBeenCalled();
    expect(mockLoadSample).not.toHaveBeenCalled();
  });

  it('pad_15 the chord shows once the engine started', async () => {
    const release = holdEngine();
    await openPage();
    await openImprov();

    await clickChord('Cm7');
    expect(calls('padPlay')).toEqual([]);
    expect(shownChord()).toBe('No chord playing');
    expect(pressedChords()).toEqual([]);

    release();
    await flush();
    expect(calls('padPlay')).toEqual([[[48, 51, 55, 58]]]);
    expect(shownChord()).toBe('Cm7 · C Eb G Bb');
    expect(pressedChords()).toEqual(['Cm7']);
  });

  it('pad_15 the last click wins while the engine starts', async () => {
    const release = holdEngine();
    await openPage();
    await openImprov();

    await clickChord('Cm7');
    await clickChord('D');
    await clickChord('F7');
    release();
    await flush();

    expect(calls('padPlay')).toEqual([[[53, 57, 60, 63]]]);
    expect(pressedChords()).toEqual(['F7']);
  });

  it('pad_15 Play after Improv shares the engine and loads the kit', async () => {
    await openPage();
    await openImprov();
    await clickPlay();

    expect(mockInit).toHaveBeenCalledTimes(1);
    expect(mockLoadTake).toHaveBeenCalledTimes(54);
    expect(calls('start')).toHaveLength(1);
    expect(byId('btn-play').classList.contains('playing')).toBe(true);
    await clickPlay();
  });

  it('pad_16 engine failure', async () => {
    mockInit.mockRejectedValue(new Error('no audio'));
    await openPage();
    await openImprov();
    expect(notice()).toBe('Audio unavailable');

    await clickChord('C');
    expect(notice()).toBe('Audio unavailable');
    expect(shownChord()).toBe('No chord playing');
    expect(pressedChords()).toEqual([]);
    expect(calls('padPlay')).toEqual([]);

    // A later click retries
    mockInit.mockResolvedValue(undefined);
    await clickChord('C');
    expect(mockInit).toHaveBeenCalledTimes(3);
    expect(notice()).toBeNull();
    expect(shownChord()).toBe('C · C E G');
    expect(calls('padPlay')).toEqual([[[48, 52, 55]]]);
  });

  it('pad_56 resumes audio', async () => {
    const release = holdEngine();
    await openPage();
    await openImprov();
    expect(mockNode.resumeContext).not.toHaveBeenCalled();

    chordButton('C').click(); // No await: the browser only honours it within the click
    expect(mockNode.resumeContext).toHaveBeenCalledTimes(1);

    release();
    await flush();
    chordButton('D').click();
    expect(mockNode.resumeContext).toHaveBeenCalledTimes(2);
    await flush();
  });

  const stopPad = () => byId<HTMLButtonElement>('pad-stop').click();
  const dotLit = () => byId('nav-improv').querySelector('.status-dot')!.classList.contains('lit');
  const padCommands = () => audioCalls.filter(call => call.method.startsWith('pad'));

  // A chord sounding, with the log cleared, for a path that must leave it alone
  const holdChord = async () => {
    await openPage();
    await openImprov();
    await clickChord('C7M(9)');
    audioCalls.length = 0;
  };
  const expectChordKept = () => {
    expect(padCommands()).toEqual([]);
    expect(shownChord()).toBe('C7M(9) · C E G B D');
    expect(pressedChords()).toEqual(['C7M(9)']);
    expect(dotLit()).toBe(true);
  };

  it('pad_31 grid of 168 buttons', async () => {
    await openPage();
    await openImprov();
    const types = ['major', 'm', '7', '7M', 'm7', 'sus4', 'sus2', 'add9', '9', 'm9', '7M(9)', '6', 'dim', 'aug'];
    const roots = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];

    expect([...document.querySelectorAll('#chord-grid th[scope="col"]')].map(header => header.textContent)).toEqual(types);
    const rows = [...document.querySelectorAll('#chord-grid tbody tr')];
    expect(rows.map(row => row.querySelector('th[scope="row"]')!.textContent)).toEqual(roots);
    rows.forEach((row, index) => {
      const names = types.map(type => roots[index] + (type === 'major' ? '' : type));
      expect([...row.querySelectorAll('button')].map(button => button.textContent)).toEqual(names);
    });
    const buttons = [...document.querySelectorAll('#chord-grid button')];
    expect(buttons).toHaveLength(168);
    expect(new Set(buttons.map(button => button.textContent)).size).toBe(168);
    buttons.forEach(button => expect(button.getAttribute('aria-pressed')).toBe('false'));
  });

  it('pad_32 shows the sounding chord', async () => {
    await openPage();
    await openImprov();

    await clickChord('C7M(9)');
    expect(shownChord()).toBe('C7M(9) · C E G B D');
    expect(pressedChords()).toEqual(['C7M(9)']);

    await clickChord('Ebm');
    expect(shownChord()).toBe('Ebm · Eb Gb Bb');
    expect(pressedChords()).toEqual(['Ebm']);
    expect(calls('padPlay')).toEqual([[[48, 52, 55, 59, 62]], [[51, 54, 58]]]);
    expect(calls('padStop')).toEqual([]);
  });

  it('pad_33 idle text', async () => {
    await openPage();
    await openImprov();
    expect(shownChord()).toBe('No chord playing');

    await clickChord('Cm7');
    await clickChord('Cm7'); // The sounding chord stops
    expect(shownChord()).toBe('No chord playing');
    expect(pressedChords()).toEqual([]);
    expect(calls('padStop')).toHaveLength(1);
    expect(calls('padPlay')).toHaveLength(1);

    await clickChord('Cm7'); // And starts again
    expect(shownChord()).toBe('Cm7 · C Eb G Bb');
    expect(calls('padPlay')).toHaveLength(2);
  });

  it('pad_35 stop button', async () => {
    await openPage();
    await openImprov();
    const stop = byId<HTMLButtonElement>('pad-stop');
    expect(stop.textContent).toBe('Stop');
    await clickChord('F7');

    stop.click();
    await flush();

    expect(calls('padStop')).toHaveLength(1);
    expect(calls('padPlay')).toHaveLength(1);
    expect(shownChord()).toBe('No chord playing');
    expect(pressedChords()).toEqual([]);

    await clickChord('F7'); // Stop left nothing behind for the click rule
    expect(shownChord()).toBe('F7 · F A C Eb');
    expect(calls('padPlay')).toHaveLength(2);
  });

  it('pad_36 stop disabled', async () => {
    await openPage();
    await openImprov();
    const stop = byId<HTMLButtonElement>('pad-stop');
    expect(stop.disabled).toBe(true);

    await clickChord('C');
    expect(stop.disabled).toBe(false);

    stopPad();
    expect(stop.disabled).toBe(true);

    await clickChord('C');
    await clickChord('C');
    expect(stop.disabled).toBe(true);
  });

  it('pad_40 link dot', async () => {
    await openPage();
    expect(dotLit()).toBe(false);
    await openImprov();
    expect(dotLit()).toBe(false);

    await clickChord('C');
    expect(dotLit()).toBe(true);
    for (const screen of ['editor', 'stadium', 'grooves', 'improv']) {
      byId<HTMLButtonElement>(`nav-${screen}`).click();
      await flush();
      expect(dotLit(), screen).toBe(true);
    }

    stopPad();
    expect(dotLit()).toBe(false);
  });

  it('pad_40 no dot when the engine fails', async () => {
    mockInit.mockRejectedValue(new Error('no audio'));
    await openPage();
    await openImprov();
    await clickChord('C');
    expect(dotLit()).toBe(false);
  });

  it('pad_24 transport sends no pad command', async () => {
    await holdChord();

    await clickPlay();
    expect(calls('start')).toHaveLength(1);
    expectChordKept();

    await clickPlay();
    expect(calls('stop')).toHaveLength(1);
    expectChordKept();

    byId<HTMLButtonElement>('btn-stadium-play').click();
    await flush();
    byId<HTMLButtonElement>('btn-stadium-play').click();
    await flush();
    expect(calls('stop')).toHaveLength(2);
    expectChordKept();
  });

  it('pad_25 loading a pattern sends no pad command', async () => {
    await holdChord();

    await selectPreset('factory:rock');
    expect(byId('pattern-name').textContent).toBe('PAT: Rock Groove');
    expectChordKept();

    await selectPreset(`song:${SONGS[0].id}`);
    expect(byId('pattern-name').textContent).toBe(`PAT: ${SONGS[0].title}`);
    expectChordKept();

    const grooves = byId<HTMLSelectElement>('groove-selector');
    grooves.value = 'factory:metal';
    grooves.dispatchEvent(new Event('change'));
    await flush();
    expectChordKept();
  });

  it('pad_26 screens send no pad command', async () => {
    await holdChord();

    for (const screen of ['editor', 'stadium', 'grooves', 'improv', 'editor', 'improv']) {
      byId<HTMLButtonElement>(`nav-${screen}`).click();
      await flush();
      expectChordKept();
    }
  });

  it('pad_45 opens silent', async () => {
    await holdChord();
    expect(localStorage.getItem('metrorig_view_mode')).toBe('improv');

    await openPage(); // A reload on the saved screen, after a chord sounded
    await flush();

    expect(calls('padPlay')).toEqual([]);
    expect(calls('padStop')).toEqual([]);
    expect(shownChord()).toBe('No chord playing');
    expect(pressedChords()).toEqual([]);
    expect(dotLit()).toBe(false);
    expect(mockNode.resumeContext).not.toHaveBeenCalled();

    byId<HTMLButtonElement>('nav-editor').click();
    await openPage();
    expect(calls('padPlay')).toEqual([]);
    expect(dotLit()).toBe(false);
  });

  const volumeSlider = () => byId('pad-volume');
  const moveVolume = (value: string) => {
    volumeSlider().value = value;
    volumeSlider().dispatchEvent(new Event('input'));
  };

  afterEach(() => localStorage.removeItem('metrorig_pad_volume'));

  it('pad_42 volume control', async () => {
    await openPage();
    await openImprov();
    expect(document.querySelectorAll('#improv-view input[type="range"]')).toHaveLength(1);
    expect([...document.querySelectorAll('#improv-view button')].filter(button => button.textContent === 'Stop')).toHaveLength(1);
    expect(document.querySelector<HTMLLabelElement>('label[for="pad-volume"]')?.textContent).toBe('Volume');
    expect(volumeSlider().min).toBe('0');
    expect(volumeSlider().max).toBe('100');
    await clickChord('C');
    audioCalls.length = 0;

    moveVolume('30');
    moveVolume('0');
    moveVolume('100');

    // Nothing but the pad's level moves: no drum, tempo or chord message
    expect(audioCalls).toEqual([
      { method: 'padVolume', args: [0.3] },
      { method: 'padVolume', args: [0] },
      { method: 'padVolume', args: [1] },
    ]);
    expect(byId('pad-volume-value').textContent).toBe('100');
    expect(shownChord()).toBe('C · C E G');
  });

  it('pad_43 remembers the volume', async () => {
    await openPage();
    await openImprov();
    expect(volumeSlider().value).toBe('70');
    moveVolume('30');
    expect(localStorage.getItem('metrorig_pad_volume')).toBe('30');

    await openPage(); // A reload on Improv: the engine takes 30 before any chord

    expect(volumeSlider().value).toBe('30');
    expect(byId('pad-volume-value').textContent).toBe('30');
    expect(calls('padVolume')).toEqual([[0.3]]);
    expect(calls('padPlay')).toEqual([]);
    await clickChord('C');
    expect(audioCalls.map(call => call.method).filter(method => method.startsWith('pad'))).toEqual(['padVolume', 'padPlay']);
  });

  it('pad_43 sends the stored volume when Play starts the engine', async () => {
    localStorage.setItem('metrorig_pad_volume', '30');
    await openPage();
    expect(calls('padVolume')).toEqual([]);

    await clickPlay();

    expect(calls('padVolume')).toEqual([[0.3]]);
    await clickPlay();
  });

  it('pad_43 a volume moved while the engine starts reaches it', async () => {
    const release = holdEngine();
    await openPage();
    await openImprov();
    moveVolume('30');

    release();
    await flush();

    expect(lastCall('padVolume')).toEqual([0.3]);
  });

  it('pad_43 an invalid stored volume falls back to 70', async () => {
    for (const stored of ['abc', '101', '-1', '']) {
      localStorage.setItem('metrorig_pad_volume', stored);
      await openPage();
      await openImprov();
      expect(volumeSlider().value, stored).toBe('70');
      expect(calls('padVolume'), stored).toEqual([[0.7]]);
      localStorage.removeItem('metrorig_view_mode');
    }
  });

  const BANK_URLS = ['Gs2', 'C3', 'E3', 'Gs3', 'C4', 'E4', 'Gs4', 'C5'].map(note => `/pads/new-age/${note}.flac`);
  const loadedUrls = () => mockPadLoad.mock.calls.map(([, url]) => url);
  const failFiles = (urls: string[]) => mockPadLoad.mockImplementation((_key: number, url: string) =>
    urls.includes(url) ? Promise.reject(new Error('404')) : Promise.resolve());

  beforeEach(() => {
    mockPadLoad.mockReset();
    mockPadLoad.mockResolvedValue(undefined);
  });

  it('pad_46 loads on first open', async () => {
    await openPage();
    await openImprov();

    expect(loadedUrls()).toEqual(BANK_URLS);
    expect(mockPadLoad.mock.calls[0]).toEqual([44, '/pads/new-age/Gs2.flac', 164330, 388482]);
    expect(mockPadLoad.mock.calls[7]).toEqual([72, '/pads/new-age/C5.flac', 104269, 265523]);
    expect(notice()).toBeNull();
    expect(calls('padPlay')).toEqual([]);
    expect(mockLoadTake).not.toHaveBeenCalled();

    byId<HTMLButtonElement>('nav-editor').click();
    await openImprov();
    expect(mockPadLoad).toHaveBeenCalledTimes(8); // Nothing failed, so nothing is fetched again
  });

  it('pad_46 each file awaits the last, and a chord does not wait for them', async () => {
    const finish: (() => void)[] = [];
    mockPadLoad.mockImplementation(() => new Promise<void>(resolve => finish.push(resolve)));
    await openPage();
    await openImprov();
    expect(mockPadLoad).toHaveBeenCalledTimes(1);

    await clickChord('C');
    expect(shownChord()).toBe('C · C E G'); // The synth covers the load (PAD-48)

    finish[0]();
    await flush();
    expect(mockPadLoad).toHaveBeenCalledTimes(2);

    byId<HTMLButtonElement>('nav-editor').click();
    await openImprov(); // A second visit during the load starts no second one
    expect(mockPadLoad).toHaveBeenCalledTimes(2);

    for (let index = 1; index < 8; index++) {
      finish[index]();
      await flush();
    }
    expect(loadedUrls()).toEqual(BANK_URLS);
  });

  it('pad_46 loads after the engine, and a failed engine loads on the next visit', async () => {
    mockInit.mockRejectedValueOnce(new Error('no audio'));
    await openPage();
    await openImprov();
    expect(mockPadLoad).not.toHaveBeenCalled();
    expect(notice()).toBe('Audio unavailable');

    byId<HTMLButtonElement>('nav-editor').click();
    await openImprov();

    expect(notice()).toBeNull();
    expect(loadedUrls()).toEqual(BANK_URLS);
  });

  it('pad_47 loads nothing before', async () => {
    await openPage();
    for (const screen of ['stadium', 'grooves', 'editor']) {
      byId<HTMLButtonElement>(`nav-${screen}`).click();
      await flush();
    }
    await clickPlay();
    await clickPlay();

    expect(mockLoadTake).toHaveBeenCalled(); // The kit loaded, the bank did not
    expect(mockPadLoad).not.toHaveBeenCalled();
  });

  it('pad_50 logs a failed file', async () => {
    const logged = vi.spyOn(console, 'error').mockImplementation(() => {});
    const failure = new Error('404');
    mockPadLoad.mockImplementation((_key: number, url: string) =>
      url === '/pads/new-age/C3.flac' ? Promise.reject(failure) : Promise.resolve());
    await openPage();
    await openImprov();

    expect(logged).toHaveBeenCalledWith('Failed to load /pads/new-age/C3.flac:', failure);
    expect(logged.mock.calls.filter(([message]) => String(message).startsWith('Failed to load'))).toHaveLength(1);
    expect(loadedUrls()).toEqual(BANK_URLS); // The other 7 were still requested
    logged.mockRestore();
  });

  it('pad_51 failure notices', async () => {
    const logged = vi.spyOn(console, 'error').mockImplementation(() => {});

    failFiles(BANK_URLS.slice(0, 7));
    await openPage();
    await openImprov();
    expect(notice()).toBe('Some samples unavailable');

    localStorage.removeItem('metrorig_view_mode');
    failFiles(BANK_URLS.slice(7));
    await openPage();
    await openImprov();
    expect(notice()).toBe('Some samples unavailable');

    localStorage.removeItem('metrorig_view_mode');
    failFiles(BANK_URLS);
    await openPage();
    expect(notice()).toBeNull(); // Not before a load failed
    await openImprov();
    expect(notice()).toBe('Samples unavailable · synth only');

    await clickChord('C'); // The synth plays on
    expect(shownChord()).toBe('C · C E G');
    expect(notice()).toBe('Samples unavailable · synth only');
    logged.mockRestore();
  });

  it('pad_53 retries failed files', async () => {
    const logged = vi.spyOn(console, 'error').mockImplementation(() => {});
    failFiles(BANK_URLS);
    await openPage();
    await openImprov();
    expect(notice()).toBe('Samples unavailable · synth only');

    // Six come back: only the 8 that failed are asked for, and two still fail
    mockPadLoad.mockClear();
    failFiles(BANK_URLS.slice(2, 4));
    byId<HTMLButtonElement>('nav-editor').click();
    await openImprov();
    expect(loadedUrls()).toEqual(BANK_URLS);
    expect(notice()).toBe('Some samples unavailable');

    mockPadLoad.mockClear();
    failFiles([]);
    byId<HTMLButtonElement>('nav-editor').click();
    await openImprov();
    expect(loadedUrls()).toEqual(BANK_URLS.slice(2, 4));
    expect(notice()).toBeNull();

    mockPadLoad.mockClear();
    byId<HTMLButtonElement>('nav-editor').click();
    await openImprov();
    expect(mockPadLoad).not.toHaveBeenCalled();
    logged.mockRestore();
  });

  it('pad_57 saved screen', async () => {
    localStorage.setItem('metrorig_view_mode', 'improv');
    await openPage();

    expect(byId('improv-view').classList.contains('hidden')).toBe(false);
    expect(mockInit).toHaveBeenCalledTimes(1);
    expect(loadedUrls()).toEqual(BANK_URLS);
    expect(calls('padPlay')).toEqual([]);
    expect(calls('padStop')).toEqual([]);
    expect(shownChord()).toBe('No chord playing');
    expect(mockNode.resumeContext).not.toHaveBeenCalled();
    expect(mockLoadTake).not.toHaveBeenCalled();
    expect(mockLoadSample).not.toHaveBeenCalled();
  });
});
