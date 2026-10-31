import { MetronomeNode } from './audio/MetronomeNode';
import { StateManager, FACTORY_PRESETS, FACTORY_GROOVES, SPEED_TRAINER_PRESETS, Preset, StoredPreset, CustomGroove, FIGURES, getBeatsPerMeasure, getBeatForStep, isSustainedStep, applyFigure, measureLengthFor, normalizePreset, startBpmFor } from './state';
import workletUrl from './audio/metronome-processor?url';

declare const gsap: any;

const state = new StateManager();
const audioNode = new MetronomeNode();

// Elements
const btnToggleView = document.getElementById('btn-toggle-view') as HTMLButtonElement;
const editorView = document.getElementById('editor-view') as HTMLElement;
const stadiumView = document.getElementById('stadium-view') as HTMLElement;

const bpmSlider = document.getElementById('bpm-slider') as HTMLInputElement;
const bpmNumber = document.getElementById('bpm-number') as HTMLElement;
const btnPlay = document.getElementById('btn-play') as HTMLButtonElement;
const btnStadiumPlay = document.getElementById('btn-stadium-play') as HTMLButtonElement;

const stadiumBpm = document.getElementById('stadium-bpm') as HTMLElement;
const stadiumTimer = document.getElementById('stadium-timer') as HTMLElement;
const stadiumStatus = document.getElementById('stadium-status') as HTMLElement;

const panelHeaderText = document.getElementById('panel-header-text') as HTMLElement;
const saveToast = document.getElementById('save-toast') as HTMLElement;
const trainerToggle = document.getElementById('trainer-toggle') as HTMLElement;
const trainerBody = document.getElementById('trainer-body') as HTMLElement;
const trainerChevron = document.getElementById('trainer-chevron') as HTMLElement;
const trainerDot = document.getElementById('trainer-dot') as HTMLElement;
const clockFace = document.getElementById('clock-face') as unknown as SVGGElement;
const clockHand = document.getElementById('clock-hand') as unknown as SVGLineElement;
const orbs = [0, 1, 2, 3].map(i => document.getElementById(`orb-${i}`) as HTMLElement);

const trainerEnable = document.getElementById('trainer-enable') as HTMLInputElement;
const trainerStart = document.getElementById('trainer-start') as HTMLInputElement;
const trainerTarget = document.getElementById('trainer-target') as HTMLInputElement;
const trainerInc = document.getElementById('trainer-inc') as HTMLInputElement;
const trainerType = document.getElementById('trainer-type') as HTMLSelectElement;
const trainerVal = document.getElementById('trainer-val') as HTMLInputElement;
const trainerCurve = document.getElementById('trainer-curve') as HTMLSelectElement;

const figurePalette = document.getElementById('figure-palette') as HTMLElement;
const gridContainer = document.getElementById('grid-container') as HTMLElement;

const presetSelector = document.getElementById('preset-selector') as HTMLSelectElement;
const groupSignatures = document.getElementById('group-signatures') as HTMLOptGroupElement;
const groupGenres = document.getElementById('group-genres') as HTMLOptGroupElement;
const groupTrainers = document.getElementById('group-trainers') as HTMLOptGroupElement;
const groupUser = document.getElementById('group-user') as HTMLOptGroupElement;
const stadiumPresetSelector = document.getElementById('stadium-preset-selector') as HTMLSelectElement;
const presetNameInput = document.getElementById('preset-name') as HTMLInputElement;
const btnSave = document.getElementById('btn-save') as HTMLButtonElement;
const clickSoundSelector = document.getElementById('click-sound-selector') as HTMLSelectElement;

const timeSigNum = document.getElementById('time-sig-num') as HTMLInputElement;
const timeSigDen = document.getElementById('time-sig-den') as HTMLSelectElement;

const grooveSelector = document.getElementById('groove-selector') as HTMLSelectElement;
const btnSaveGroove = document.getElementById('btn-save-groove') as HTMLButtonElement;

// Helper to show save button when preset is modified
function markPresetAsModified() {
  // Pre-populate with the current preset name so user can build on it
  if (!presetNameInput.value) {
    presetNameInput.value = state.activePreset.name;
  }
  gsap.killTweensOf(saveToast);
  gsap.set(saveToast, { display: 'flex' });
  gsap.to(saveToast, { y: 0, opacity: 1, duration: 0.25, ease: 'power2.out', pointerEvents: 'auto' });
}

// Build option elements
function populatePresetsDropdown(selectedId?: string) {
  groupSignatures.innerHTML = '';
  groupGenres.innerHTML = '';
  groupTrainers.innerHTML = '';
  stadiumPresetSelector.innerHTML = '<option value="">Choose a speed trainer</option>';
  
  // Add Factory Time Signatures (indices 0 to 3)
  FACTORY_PRESETS.slice(0, 4).forEach(p => {
    const opt = document.createElement('option');
    opt.value = `factory:${p.id}`;
    opt.innerText = p.name;
    groupSignatures.appendChild(opt);
  });
  
  // Add Factory Genres (indices 4 onwards)
  FACTORY_PRESETS.slice(4).forEach(p => {
    const opt = document.createElement('option');
    opt.value = `factory:${p.id}`;
    opt.innerText = p.name;
    groupGenres.appendChild(opt);
  });

  // Add Speed Trainers to both the header and Stadium dropdowns
  SPEED_TRAINER_PRESETS.forEach(p => {
    const opt = document.createElement('option');
    opt.value = `factory:${p.id}`;
    opt.innerText = p.name;
    groupTrainers.appendChild(opt);
    stadiumPresetSelector.appendChild(opt.cloneNode(true));
  });

  // Load User Presets from database
  state.getAllPresets().then(userPresets => {
    groupUser.innerHTML = '';
    if (userPresets.length === 0) {
      const opt = document.createElement('option');
      opt.disabled = true;
      opt.innerText = "No custom presets";
      groupUser.appendChild(opt);
    } else {
      userPresets.forEach(p => {
        const opt = document.createElement('option');
        opt.value = `user:${p.id}`;
        opt.innerText = p.name;
        groupUser.appendChild(opt);
      });
    }
    if (selectedId) {
      presetSelector.value = selectedId;
    } else {
      presetSelector.value = `factory:${state.activePreset.id}`;
    }
    syncStadiumPresetSelector();
  });
}

// Shows the placeholder when the active preset is not a speed trainer
function syncStadiumPresetSelector() {
  stadiumPresetSelector.value = presetSelector.value;
  if (stadiumPresetSelector.selectedIndex < 0) stadiumPresetSelector.value = '';
}

// Initialize Metronome Engine
let isAudioInit = false;
async function initAudio() {
  if (isAudioInit) return;
  // Compile Wasm and launch worklet using assets loaded through Vite
  await audioNode.init('/pkg/metrorig_audio_bg.wasm', workletUrl);
  
  // Load default empty samples
  await audioNode.loadSample(1, '/kick.wav');
  await audioNode.loadSample(2, '/snare.wav');
  await audioNode.loadSample(3, '/hihat.wav');
  
  isAudioInit = true;
  await syncClickSound(); // Wait for click sound loading
  syncAudioSettings();
}

// Sends the start tempo, so it runs only on Play and preset load
function syncAudioSettings() {
  if (!isAudioInit) return;

  audioNode.setBpm(startBpmFor(state.activePreset));
  syncPlaybackSettings();
}

// Sends everything but BPM, so a change during playback keeps the live tempo
function syncPlaybackSettings() {
  if (!isAudioInit) return;

  // Set measure length
  audioNode.setMeasureLength(state.activePreset.measureLength || 16);
  
  // Update active tracks
  for (let trackId = 0; trackId < 4; trackId++) {
    const steps = new Uint8Array(state.activePreset.gridData[trackId] || new Array(16).fill(0));
    audioNode.updateGrid(trackId, steps);
  }
  
  // Set trainer
  audioNode.setTrainer({
    enabled: trainerEnable.checked,
    startBpm: Number(trainerStart.value),
    targetBpm: Number(trainerTarget.value),
    increment: Number(trainerInc.value),
    stepType: trainerType.value as 'measures' | 'seconds',
    stepValue: Number(trainerVal.value),
    curve: trainerCurve.value as 'stepped' | 'smooth'
  });
}

// Draw Sequencer Grid
const trackNames = ['Click', 'Kick', 'Snare', 'Hi-hat'];
const SUBDIVISION_LABELS: Record<number, string[]> = { 2: ['', '&'], 4: ['', 'e', '&', 'a'] };

// Figure stamped by grid clicks; null toggles single steps
let activeFigure: typeof FIGURES[number] | null = null;

function drawFigurePalette() {
  figurePalette.innerHTML = '';
  [null, ...FIGURES].forEach(figure => {
    const btn = document.createElement('button');
    btn.className = figure === activeFigure ? 'figure-btn active' : 'figure-btn';
    btn.innerText = figure ? figure.name : 'Step';
    if (figure) {
      const pattern = document.createElement('span');
      pattern.className = 'figure-pattern';
      pattern.innerText = figure.pattern.map(hit => (hit ? '●' : '·')).join('');
      btn.appendChild(pattern);
    }
    btn.onclick = () => {
      activeFigure = figure;
      drawFigurePalette();
    };
    figurePalette.appendChild(btn);
  });
}

function drawGrid() {
  gridContainer.innerHTML = '';
  const { gridData, timeSignature } = state.activePreset;
  const measureLength = state.activePreset.measureLength || 16;
  const beats = getBeatsPerMeasure(timeSignature, measureLength);
  const stepsPerBeat = measureLength / beats;

  // A narrow spacer column separates beats, so each step maps to its own grid column
  const templateColumns = ['auto'];
  const stepColumns: number[] = [];
  for (let step = 0; step < measureLength; step++) {
    const isBeatStart = (step * beats) % measureLength === 0;
    if (step > 0 && isBeatStart) templateColumns.push('0.5rem');
    templateColumns.push('1fr');
    stepColumns.push(templateColumns.length);
  }
  gridContainer.style.gridTemplateColumns = templateColumns.join(' ');

  // Count row: 1 e & a 2 e & a ...
  for (let step = 0; step < measureLength; step++) {
    const beat = getBeatForStep(step, measureLength, beats);
    const isBeatStart = (step * beats) % measureLength === 0;
    const count = document.createElement('div');
    count.className = isBeatStart ? 'step-count beat-start' : 'step-count';
    count.innerText = isBeatStart
      ? String(beat + 1)
      : SUBDIVISION_LABELS[stepsPerBeat]?.[step - beat * stepsPerBeat] ?? '';
    count.style.gridRow = '1';
    count.style.gridColumn = String(stepColumns[step]);
    gridContainer.appendChild(count);
  }

  for (let trackId = 0; trackId < 4; trackId++) {
    // Label cell
    const label = document.createElement('div');
    label.className = 'track-label';
    label.setAttribute('data-track', String(trackId));
    label.innerText = trackNames[trackId];
    label.style.gridRow = String(trackId + 2);
    label.style.gridColumn = '1';
    gridContainer.appendChild(label);

    const trackSteps = gridData[trackId] ??= new Array(16).fill(0);

    for (let step = 0; step < measureLength; step++) {
      const cell = document.createElement('div');
      cell.className = 'step-cell';
      cell.setAttribute('data-track', String(trackId));
      cell.style.gridRow = String(trackId + 2);
      cell.style.gridColumn = String(stepColumns[step]);

      if (trackSteps[step] === 1) cell.classList.add('active');
      if (trackSteps[step] === 2) cell.classList.add('accent');
      if (isSustainedStep(trackSteps, step, measureLength, beats)) cell.classList.add('sustain');

      cell.onclick = () => {
        if (activeFigure) {
          applyFigure(trackSteps, step, activeFigure.pattern, measureLength);
        } else if (trackId === 0) {
          trackSteps[step] = (trackSteps[step] + 1) % 3;
        } else {
          trackSteps[step] = trackSteps[step] === 1 ? 0 : 1;
        }

        if (isAudioInit) {
          audioNode.updateGrid(trackId, new Uint8Array(trackSteps));
        }
        drawGrid();
        markPresetAsModified();
      };

      gridContainer.appendChild(cell);
    }
  }

  drawBeatClock();
}

// Draw Stadium beat clock: one ring per track, one slice per step, 12 o'clock is step 0
const SVG_NS = 'http://www.w3.org/2000/svg';
const CLOCK_RING_OUTER = 80;
const CLOCK_RING_WIDTH = 12.5;
const CLOCK_LABEL_RADIUS = 90;

function clockPoint(fraction: number, radius: number): [number, number] {
  const angle = 2 * Math.PI * fraction - Math.PI / 2;
  return [radius * Math.cos(angle), radius * Math.sin(angle)];
}

function drawBeatClock() {
  const { gridData, timeSignature } = state.activePreset;
  const measureLength = state.activePreset.measureLength || 16;
  const beats = getBeatsPerMeasure(timeSignature, measureLength);
  clockFace.innerHTML = '';

  for (let trackId = 0; trackId < 4; trackId++) {
    const radius = CLOCK_RING_OUTER - CLOCK_RING_WIDTH * trackId;
    const trackSteps = gridData[trackId] || [];
    for (let step = 0; step < measureLength; step++) {
      // A slice can't span the full circle, which a single-step measure would need
      const [x1, y1] = clockPoint(step / measureLength, radius);
      const [x2, y2] = clockPoint((step + 1) / measureLength - 0.0001, radius);
      const largeArc = measureLength === 1 ? 1 : 0;

      const slice = document.createElementNS(SVG_NS, 'path');
      slice.setAttribute('d', `M ${x1} ${y1} A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2} L 0 0 Z`);
      const sustained = isSustainedStep(trackSteps, step, measureLength, beats);
      slice.setAttribute('class', trackSteps[step] > 0 ? 'clock-slice on' : sustained ? 'clock-slice sustain' : 'clock-slice');
      slice.setAttribute('data-track', String(trackId));
      clockFace.appendChild(slice);
    }
  }

  const center = document.createElementNS(SVG_NS, 'circle');
  center.setAttribute('r', String(CLOCK_RING_OUTER - CLOCK_RING_WIDTH * 4));
  center.setAttribute('class', 'clock-center');
  clockFace.appendChild(center);

  for (let beat = 0; beat < beats; beat++) {
    const [lineX, lineY] = clockPoint(beat / beats, CLOCK_RING_OUTER);
    const line = document.createElementNS(SVG_NS, 'line');
    line.setAttribute('x2', String(lineX));
    line.setAttribute('y2', String(lineY));
    line.setAttribute('class', 'clock-beat-line');
    clockFace.insertBefore(line, center);

    const [x, y] = clockPoint(beat / beats, CLOCK_LABEL_RADIUS);
    const label = document.createElementNS(SVG_NS, 'text');
    label.setAttribute('x', String(x));
    label.setAttribute('y', String(y));
    label.setAttribute('class', 'clock-label');
    label.textContent = String(beat + 1);
    clockFace.appendChild(label);
  }
}

function highlightBeat(beat: number | null) {
  clockFace.querySelectorAll('.clock-label').forEach((label, i) => {
    label.classList.toggle('active', i === beat);
  });
}

function resetBeatClock() {
  gsap.killTweensOf(clockHand);
  gsap.set(clockHand, { rotation: 0, svgOrigin: '0 0' });
  highlightBeat(null);
}

// Handle Play/Stop state
let timerInterval: any = null;
let startTime = 0;

function togglePlay() {
  initAudio().then(() => {
    if (state.isPlaying) {
      audioNode.stop();
      state.isPlaying = false;
      btnPlay.classList.remove('playing');
      btnStadiumPlay.classList.remove('playing');
      clearInterval(timerInterval);
      resetBeatClock();
      bpmNumber.innerText = String(state.activePreset.bpm);
    } else {
      syncAudioSettings();
      audioNode.start();
      state.isPlaying = true;
      btnPlay.classList.add('playing');
      btnStadiumPlay.classList.add('playing');
      
      startTime = Date.now();
      timerInterval = setInterval(updatePracticeTimer, 1000);
    }
  });
}

function updatePracticeTimer() {
  const elapsed = Math.floor((Date.now() - startTime) / 1000);
  const mm = String(Math.floor(elapsed / 60)).padStart(2, '0');
  const ss = String(elapsed % 60).padStart(2, '0');
  stadiumTimer.innerText = `${mm}:${ss}`;
}

// Subscriptions & Events
state.subscribe((s) => {
  // Sync View Mode
  if (s.activeViewMode === 'editor') {
    editorView.classList.remove('hidden');
    stadiumView.classList.add('hidden');
    btnToggleView.innerText = 'GO TO STADIUM MODE';
  } else {
    editorView.classList.add('hidden');
    stadiumView.classList.remove('hidden');
    btnToggleView.innerText = 'GO TO EDITOR MODE';
  }
});

// UI Event Bindings
btnToggleView.onclick = () => {
  state.setViewMode(state.activeViewMode === 'editor' ? 'stadium' : 'editor');
};

bpmSlider.oninput = () => {
  const bpm = Number(bpmSlider.value);
  bpmNumber.innerText = String(bpm);
  state.activePreset.bpm = bpm;
  if (isAudioInit) audioNode.setBpm(bpm);
  markPresetAsModified();

  const ts = measureLengthToTimeSig(state.activePreset.measureLength || 16);
  panelHeaderText.textContent = `${state.activePreset.name}  ·  ${ts}  ·  ${bpm} BPM`;
};

function updateTimeSignature() {
  let num = parseInt(timeSigNum.value, 10);
  if (isNaN(num) || num < 1) num = 1;
  if (num > 16) num = 16;
  timeSigNum.value = String(num);

  const den = Number(timeSigDen.value);
  const sigStr = `${num}/${den}`;
  
  const measureLength = measureLengthFor(num, den);

  // Clamp to 32 steps max
  if (measureLength > 32) {
    alert("Time signature exceeds the maximum limit of 32 steps!");
    if (state.activePreset.timeSignature) {
      const parts = state.activePreset.timeSignature.split('/');
      timeSigNum.value = parts[0];
      timeSigDen.value = parts[1];
    }
    return;
  }

  grooveSelector.value = "";

  state.activePreset.timeSignature = sigStr;
  state.activePreset.measureLength = measureLength;

  // Resize gridData tracks to match the new length
  for (let trackId = 0; trackId < 4; trackId++) {
    const oldSteps = state.activePreset.gridData[trackId] || [];
    const newSteps = new Array(measureLength).fill(0);
    for (let i = 0; i < Math.min(oldSteps.length, measureLength); i++) {
      newSteps[i] = oldSteps[i];
    }
    state.activePreset.gridData[trackId] = newSteps;
  }

  drawGrid();
  syncPlaybackSettings();
  markPresetAsModified();

  const bpm = state.activePreset.bpm;
  panelHeaderText.textContent = `${state.activePreset.name}  ·  ${sigStr}  ·  ${bpm} BPM`;
}

timeSigNum.onchange = updateTimeSignature;
timeSigDen.onchange = updateTimeSignature;

btnPlay.onclick = togglePlay;
btnStadiumPlay.onclick = togglePlay;

// React to trainer config updates dynamically
const formInputs = [trainerEnable, trainerStart, trainerTarget, trainerInc, trainerType, trainerVal, trainerCurve];
formInputs.forEach(el => {
  el.onchange = () => {
    // Sync DOM trainer values back into state so saves are accurate
    state.activePreset.trainerSettings = {
      enabled: trainerEnable.checked,
      startBpm: Number(trainerStart.value),
      targetBpm: Number(trainerTarget.value),
      increment: Number(trainerInc.value),
      stepType: trainerType.value as 'measures' | 'seconds',
      stepValue: Number(trainerVal.value),
      curve: trainerCurve.value as 'stepped' | 'smooth'
    };
    syncPlaybackSettings();
    markPresetAsModified();
  };
});

let trainerOpen = false;
trainerToggle.onclick = () => {
  trainerOpen = !trainerOpen;
  if (trainerOpen) {
    gsap.to(trainerBody, { height: 'auto', duration: 0.3, ease: 'power2.out' });
    gsap.to(trainerChevron, { rotation: 180, duration: 0.3, ease: 'power2.out' });
  } else {
    gsap.to(trainerBody, { height: 0, duration: 0.25, ease: 'power2.in' });
    gsap.to(trainerChevron, { rotation: 0, duration: 0.25, ease: 'power2.in' });
  }
};

trainerEnable.addEventListener('change', () => {
  if (trainerEnable.checked) {
    trainerDot.classList.add('visible');
  } else {
    trainerDot.classList.remove('visible');
  }
});

function updateStadiumStatus() {
  const bars = trainerVal.value === '1' ? 'bar' : 'bars';
  const unit = trainerType.value === 'measures' ? bars : 's';
  stadiumStatus.innerText = trainerEnable.checked
    ? `Trainer ${trainerStart.value} → ${trainerTarget.value} BPM · +${trainerInc.value} every ${trainerVal.value} ${unit}`
    : 'Trainer Off';
}

// Stepped runs read as integers; Smooth runs show their real value
function formatLiveBpm(bpm: number): string {
  return Number.isInteger(bpm) ? String(bpm) : bpm.toFixed(1);
}

// Handle Tick triggers from audio worklet thread
audioNode.addEventListener('tick', (e: any) => {
  const { beatIndex, currentBpm, activeTrackIds } = e.detail;

  // Update BPM text
  stadiumBpm.innerText = Number(currentBpm).toFixed(1);

  updateStadiumStatus();

  // Beat clock and Editor BPM (ticks still in flight after stop must not restart them)
  if (state.isPlaying) {
    bpmNumber.innerText = formatLiveBpm(Number(currentBpm));

    const { timeSignature } = state.activePreset;
    const measureLength = state.activePreset.measureLength || 16;
    const beats = getBeatsPerMeasure(timeSignature, measureLength);
    const stepDuration = 60 / Number(currentBpm) / 4; // Engine runs 4 steps per BPM beat
    highlightBeat(getBeatForStep(beatIndex, measureLength, beats));
    gsap.killTweensOf(clockHand);
    gsap.fromTo(clockHand,
      { rotation: (beatIndex / measureLength) * 360, svgOrigin: '0 0' },
      { rotation: ((beatIndex + 1) / measureLength) * 360, duration: stepDuration, ease: 'none' }
    );
  }

  // Orbs keep a steady color and only nudge in size, avoiding luminance flashes
  const ids: number[] = activeTrackIds ?? [];
  ids.forEach((trackId: number) => {
    const orb = orbs[trackId];
    if (!orb) return;
    gsap.killTweensOf(orb);
    gsap.fromTo(orb,
      { scale: 1.15 },
      { scale: 1.0, duration: 0.2, ease: 'power2.out' }
    );
  });
});

// Handle Preset Dropdown Selection Change
presetSelector.onchange = () => {
  const val = presetSelector.value;
  let targetPreset: Preset | undefined;
  syncStadiumPresetSelector();

  if (val.startsWith('factory:')) {
    const pid = val.replace('factory:', '');
    targetPreset = [...FACTORY_PRESETS, ...SPEED_TRAINER_PRESETS].find(p => p.id === pid);
    if (targetPreset) {
      loadPresetIntoUI(targetPreset);
    }
  } else if (val.startsWith('user:')) {
    const pid = val.replace('user:', '');
    state.getAllPresets().then(userPresets => {
      const p = userPresets.find(up => up.id === pid);
      if (p) loadPresetIntoUI(p);
    });
  }
};

stadiumPresetSelector.onchange = () => {
  if (!stadiumPresetSelector.value) return;
  presetSelector.value = stadiumPresetSelector.value;
  presetSelector.dispatchEvent(new Event('change'));
};

function measureLengthToTimeSig(len: number): string {
  // Try to parse from state.activePreset.timeSignature first
  if (state.activePreset.timeSignature && state.activePreset.timeSignature.includes('/')) {
    return state.activePreset.timeSignature;
  }
  const map: Record<number, string> = { 12: '3/4', 14: '7/8', 16: '4/4' };
  return map[len] ?? `${len} steps`;
}

function loadPresetIntoUI(storedPreset: StoredPreset) {
  const preset = normalizePreset(storedPreset);
  state.activePreset = preset;
  const ts = preset.trainerSettings;
  
  bpmSlider.value = String(state.activePreset.bpm);
  bpmNumber.innerText = String(state.activePreset.bpm);
  
  // parse timeSignature
  if (preset.timeSignature && preset.timeSignature.includes('/')) {
    const parts = preset.timeSignature.split('/');
    timeSigNum.value = parts[0];
    timeSigDen.value = parts[1];
  } else {
    const map: Record<number, {num: string, den: string}> = {
      12: { num: '3', den: '4' },
      14: { num: '7', den: '8' },
      16: { num: '4', den: '4' }
    };
    const parsed = map[preset.measureLength] || { num: String(preset.measureLength), den: '16' };
    timeSigNum.value = parsed.num;
    timeSigDen.value = parsed.den;
    state.activePreset.timeSignature = `${parsed.num}/${parsed.den}`;
  }

  // Sync trainer DOM inputs from preset state
  trainerEnable.checked = ts.enabled;
  trainerStart.value = String(ts.startBpm);
  trainerTarget.value = String(ts.targetBpm);
  trainerInc.value = String(ts.increment);
  trainerType.value = ts.stepType;
  trainerVal.value = String(ts.stepValue);
  trainerCurve.value = ts.curve;

  if (ts.enabled) {
    trainerDot.classList.add('visible');
  } else {
    trainerDot.classList.remove('visible');
  }
  
  presetNameInput.value = '';
  gsap.killTweensOf(saveToast);
  gsap.to(saveToast, {
    y: -20,
    opacity: 0,
    duration: 0.2,
    ease: 'power2.in',
    pointerEvents: 'none',
    onComplete: () => {
      gsap.set(saveToast, { display: 'none' });
    }
  });
  
  drawGrid();
  syncAudioSettings();
  grooveSelector.value = "";

  const bpm = state.activePreset.bpm;
  const timeSig = measureLengthToTimeSig(state.activePreset.measureLength || 16);
  panelHeaderText.textContent = `${state.activePreset.name}  ·  ${timeSig}  ·  ${bpm} BPM`;

  stadiumBpm.innerText = bpm.toFixed(1);
  updateStadiumStatus();
}

btnSave.onclick = () => {
  const name = presetNameInput.value.trim() || 'Custom Preset';
  const id = 'user_' + Date.now();
  
  const newPreset: Preset = {
    id,
    name,
    bpm: state.activePreset.bpm,
    timeSignature: state.activePreset.timeSignature,
    measureLength: state.activePreset.measureLength || 16,
    gridData: JSON.parse(JSON.stringify(state.activePreset.gridData)),
    trainerSettings: JSON.parse(JSON.stringify(state.activePreset.trainerSettings))
  };
  
  state.savePreset(newPreset).then(() => {
    state.activePreset = newPreset;
    populatePresetsDropdown(`user:${id}`);
    presetNameInput.value = '';
    gsap.killTweensOf(saveToast);
    gsap.to(saveToast, {
      y: -20,
      opacity: 0,
      duration: 0.2,
      ease: 'power2.in',
      pointerEvents: 'none',
      onComplete: () => {
        gsap.set(saveToast, { display: 'none' });
      }
    });
  });
};

function populateGroovesDropdown() {
  grooveSelector.innerHTML = '<option value="">-- Choose a Groove --</option>';
  
  const factoryGroup = document.createElement('optgroup');
  factoryGroup.label = "Factory Grooves";
  FACTORY_GROOVES.forEach(g => {
    const opt = document.createElement('option');
    opt.value = `factory:${g.id}`;
    opt.innerText = g.name;
    factoryGroup.appendChild(opt);
  });
  grooveSelector.appendChild(factoryGroup);

  state.getAllGrooves().then(userGrooves => {
    if (userGrooves.length > 0) {
      const userGroup = document.createElement('optgroup');
      userGroup.label = "User Grooves";
      userGrooves.forEach(g => {
        const opt = document.createElement('option');
        opt.value = `user:${g.id}`;
        opt.innerText = g.name;
        userGroup.appendChild(opt);
      });
      grooveSelector.appendChild(userGroup);
    }
  });
}

grooveSelector.onchange = () => {
  const val = grooveSelector.value;
  if (!val) return;

  const activeLen = state.activePreset.measureLength || 16;

  const applyPattern = (length: number, tracks: Record<number, number[]>) => {
    for (let trackId = 1; trackId < 4; trackId++) {
      const srcPattern = tracks[trackId] || [];
      const destPattern = new Array(activeLen).fill(0);
      for (let i = 0; i < activeLen; i++) {
        destPattern[i] = srcPattern[i % length] || 0;
      }
      state.activePreset.gridData[trackId] = destPattern;
    }
    drawGrid();
    syncPlaybackSettings();
    markPresetAsModified();
  };

  if (val.startsWith('factory:')) {
    const gid = val.replace('factory:', '');
    const g = FACTORY_GROOVES.find(fg => fg.id === gid);
    if (g) applyPattern(g.length, g.tracks);
  } else if (val.startsWith('user:')) {
    const gid = val.replace('user:', '');
    state.getAllGrooves().then(grooves => {
      const g = grooves.find(ug => ug.id === gid);
      if (g) applyPattern(g.measureLength, g.gridData);
    });
  }
};

btnSaveGroove.onclick = () => {
  const name = prompt("Enter a name for your Drum Groove:");
  if (!name) return;

  const activeLen = state.activePreset.measureLength || 16;
  const gridData: Record<number, number[]> = {};
  for (let trackId = 1; trackId < 4; trackId++) {
    const srcTrack = state.activePreset.gridData[trackId] || [];
    const paddedTrack = new Array(activeLen).fill(0);
    for (let i = 0; i < Math.min(srcTrack.length, activeLen); i++) {
      paddedTrack[i] = srcTrack[i];
    }
    gridData[trackId] = paddedTrack;
  }

  const id = 'groove_' + Date.now();
  const newGroove = { id, name, gridData, measureLength: activeLen };

  state.saveGroove(newGroove).then(() => {
    populateGroovesDropdown();
    alert(`Groove "${name}" saved successfully!`);
  });
};

// Click Sound logic
let activeClickLoadId = 0;

async function syncClickSound() {
  if (!isAudioInit) return;
  const sound = clickSoundSelector.value;
  if (sound === 'digital') {
    activeClickLoadId++;
    audioNode.setClickMode(0);
  } else {
    const loadId = ++activeClickLoadId;
    try {
      await audioNode.loadSample(0, `/${sound}.wav`);
      if (loadId === activeClickLoadId) {
        audioNode.setClickMode(1);
      }
    } catch (err) {
      console.error("Failed to load click sample, falling back to digital synth:", err);
      if (loadId === activeClickLoadId) {
        audioNode.setClickMode(0);
      }
    }
  }
}

clickSoundSelector.onchange = async () => {
  const sound = clickSoundSelector.value;
  localStorage.setItem('metrorig_click_sound', sound);
  if (isAudioInit) {
    try {
      await syncClickSound();
    } catch (err) {
      console.error("Failed to sync click sound on selector change:", err);
    }
  }
};

// Initialize dropdown value from localStorage
const storedClickSound = localStorage.getItem('metrorig_click_sound') || 'digital';
clickSoundSelector.value = storedClickSound;

// Initial draw and population
populatePresetsDropdown();
populateGroovesDropdown();
drawFigurePalette();
drawGrid();
