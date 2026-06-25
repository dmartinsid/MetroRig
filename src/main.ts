import { MetronomeNode } from './audio/MetronomeNode';
import { StateManager, FACTORY_PRESETS, Preset, CustomGroove } from './state';
import workletUrl from './audio/metronome-processor?url';

declare const gsap: any;
const TRACK_COLORS = ['#FFB800', '#FF2D55', '#00D4FF', '#00FF94'];

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
const bgFlash = document.getElementById('bg-flash') as HTMLElement;
const orbs = [0, 1, 2, 3].map(i => document.getElementById(`orb-${i}`) as HTMLElement);

const trainerEnable = document.getElementById('trainer-enable') as HTMLInputElement;
const trainerStart = document.getElementById('trainer-start') as HTMLInputElement;
const trainerTarget = document.getElementById('trainer-target') as HTMLInputElement;
const trainerInc = document.getElementById('trainer-inc') as HTMLInputElement;
const trainerType = document.getElementById('trainer-type') as HTMLSelectElement;
const trainerVal = document.getElementById('trainer-val') as HTMLInputElement;
const trainerCurve = document.getElementById('trainer-curve') as HTMLSelectElement;

const gridContainer = document.getElementById('grid-container') as HTMLElement;

const presetSelector = document.getElementById('preset-selector') as HTMLSelectElement;
const groupSignatures = document.getElementById('group-signatures') as HTMLOptGroupElement;
const groupGenres = document.getElementById('group-genres') as HTMLOptGroupElement;
const groupUser = document.getElementById('group-user') as HTMLOptGroupElement;
const presetNameInput = document.getElementById('preset-name') as HTMLInputElement;
const btnSave = document.getElementById('btn-save') as HTMLButtonElement;
const clickSoundSelector = document.getElementById('click-sound-selector') as HTMLSelectElement;

const timeSigNum = document.getElementById('time-sig-num') as HTMLInputElement;
const timeSigDen = document.getElementById('time-sig-den') as HTMLSelectElement;
const swingSlider = document.getElementById('swing-slider') as HTMLInputElement;
const swingDisplay = document.getElementById('swing-display') as HTMLElement;

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
  });
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

function syncAudioSettings() {
  if (!isAudioInit) return;
  
  // Set active BPM
  audioNode.setBpm(state.activePreset.bpm);
  
  // Set measure length
  audioNode.setMeasureLength(state.activePreset.measureLength || 16);
  
  // Set swing
  audioNode.setSwing(state.activePreset.swing || 0);
  
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
function drawGrid() {
  gridContainer.innerHTML = '';
  const measureLength = state.activePreset.measureLength || 16;
  gridContainer.style.gridTemplateColumns = `auto repeat(${measureLength}, 1fr)`;

  for (let trackId = 0; trackId < 4; trackId++) {
    // Label cell
    const label = document.createElement('div');
    label.className = 'track-label';
    label.setAttribute('data-track', String(trackId));
    label.innerText = trackNames[trackId];
    gridContainer.appendChild(label);

    const trackSteps = state.activePreset.gridData[trackId] || new Array(16).fill(0);

    for (let step = 0; step < measureLength; step++) {
      const cell = document.createElement('div');
      cell.className = 'step-cell';
      cell.setAttribute('data-track', String(trackId));

      if (trackSteps[step] === 1) cell.classList.add('active');
      if (trackSteps[step] === 2) cell.classList.add('accent');

      cell.onclick = () => {
        let nextState = 0;
        if (trackId === 0) {
          nextState = (trackSteps[step] + 1) % 3;
        } else {
          nextState = trackSteps[step] === 1 ? 0 : 1;
        }
        trackSteps[step] = nextState;

        cell.className = 'step-cell';
        cell.setAttribute('data-track', String(trackId));
        if (nextState === 1) cell.classList.add('active');
        if (nextState === 2) cell.classList.add('accent');

        if (isAudioInit) {
          audioNode.updateGrid(trackId, new Uint8Array(trackSteps));
        }
        markPresetAsModified();
      };

      gridContainer.appendChild(cell);
    }
  }
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
  
  // Calculate measure length
  let measureLength = num;
  if (den === 4) measureLength = num * 4;
  else if (den === 8) measureLength = num * 2;
  
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
  syncAudioSettings();
  markPresetAsModified();

  const bpm = state.activePreset.bpm;
  panelHeaderText.textContent = `${state.activePreset.name}  ·  ${sigStr}  ·  ${bpm} BPM`;
}

timeSigNum.onchange = updateTimeSignature;
timeSigDen.onchange = updateTimeSignature;

swingSlider.oninput = () => {
  const val = Number(swingSlider.value);
  swingDisplay.innerText = `${val}%`;
  state.activePreset.swing = val;
  if (isAudioInit) {
    audioNode.setSwing(val);
  }
  markPresetAsModified();
};

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
    syncAudioSettings();
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

// Handle Tick triggers from audio worklet thread
audioNode.addEventListener('tick', (e: any) => {
  const { currentBpm, activeTrackIds } = e.detail;

  // Update BPM text
  stadiumBpm.innerText = Number(currentBpm).toFixed(1);

  // Trainer status
  stadiumStatus.innerText = trainerEnable.checked
    ? `Trainer Running (${trainerCurve.value})`
    : 'Trainer Off';

  // BPM display glow pulse
  gsap.killTweensOf(stadiumBpm);
  gsap.fromTo(stadiumBpm,
    { textShadow: '0 0 60px rgba(57,255,20,0.9)' },
    { textShadow: '0 0 30px rgba(57,255,20,0.4)', duration: 0.4, ease: 'power2.out' }
  );

  // Orb pulses for each active track
  const ids: number[] = activeTrackIds ?? [];
  ids.forEach((trackId: number) => {
    const orb = orbs[trackId];
    const color = TRACK_COLORS[trackId];
    if (!orb || !color) return;
    gsap.killTweensOf(orb);
    gsap.to(orb, {
      scale: 1.8,
      backgroundColor: color,
      boxShadow: `0 0 40px ${color}, 0 0 80px ${color}`,
      duration: 0.05,
      ease: 'none',
      onComplete: () => {
        gsap.to(orb, {
          scale: 1.0,
          backgroundColor: `${color}1A`,
          boxShadow: 'none',
          duration: 0.35,
          ease: 'power2.out',
        });
      }
    });
  });

  // Background flash
  if (ids.length > 0) {
    // Filter out Click (0) if there are other drum hits active on this beat, to prevent click dominance
    const nonClickIds = ids.filter(id => id > 0);
    const dominantId = nonClickIds.length > 0 ? Math.min(...nonClickIds) : 0;
    const dominantColor = TRACK_COLORS[dominantId];
    gsap.set(bgFlash, { backgroundColor: dominantColor });
    gsap.fromTo(bgFlash,
      { opacity: 0.05 },
      { opacity: 0, duration: 0.35, ease: 'power2.out' }
    );
  }
});

// Handle Preset Dropdown Selection Change
presetSelector.onchange = () => {
  const val = presetSelector.value;
  let targetPreset: Preset | undefined;

  if (val.startsWith('factory:')) {
    const pid = val.replace('factory:', '');
    targetPreset = FACTORY_PRESETS.find(p => p.id === pid);
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

function measureLengthToTimeSig(len: number): string {
  // Try to parse from state.activePreset.timeSignature first
  if (state.activePreset.timeSignature && state.activePreset.timeSignature.includes('/')) {
    return state.activePreset.timeSignature;
  }
  const map: Record<number, string> = { 12: '3/4', 14: '7/8', 16: '4/4' };
  return map[len] ?? `${len} steps`;
}

function loadPresetIntoUI(preset: Preset) {
  state.activePreset = JSON.parse(JSON.stringify(preset));
  const ts = state.activePreset.trainerSettings;
  
  bpmSlider.value = String(state.activePreset.bpm);
  bpmNumber.innerText = String(state.activePreset.bpm);
  
  swingSlider.value = String(state.activePreset.swing || 0);
  swingDisplay.innerText = `${state.activePreset.swing || 0}%`;

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
    swing: state.activePreset.swing || 0,
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

const FACTORY_GROOVES = [
  { id: 'rock', name: 'Rock Groove', length: 16, tracks: { 1: [1,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0], 2: [0,0,0,0,1,0,0,0,0,0,0,0,1,0,0,0], 3: [1,0,1,0,1,0,1,0,1,0,1,0,1,0,1,0] } },
  { id: 'metal', name: 'Metal Groove', length: 16, tracks: { 1: [1,0,1,0,0,0,1,0,1,0,1,0,0,0,1,0], 2: [0,0,0,0,1,0,0,0,0,0,0,0,1,0,0,0], 3: [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1] } },
  { id: 'blues', name: 'Blues Shuffle', length: 12, tracks: { 1: [1,0,0,0,0,0,1,0,0,0,0,0], 2: [0,0,0,1,0,0,0,0,0,1,0,0], 3: [1,0,1,1,0,1,1,0,1,1,0,1] } },
  { id: 'jazz', name: 'Jazz Swing', length: 12, tracks: { 1: [1,0,0,0,0,0,1,0,0,0,0,0], 2: [0,0,0,0,0,1,0,0,0,0,0,0], 3: [1,0,1,1,0,1,1,0,1,1,0,1] } }
];

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
    syncAudioSettings();
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
async function syncClickSound() {
  if (!isAudioInit) return;
  const sound = clickSoundSelector.value;
  if (sound === 'digital') {
    audioNode.setClickMode(0);
  } else {
    // Load requested WAV sample for slot 0
    await audioNode.loadSample(0, `/${sound}.wav`);
    audioNode.setClickMode(1);
  }
}

clickSoundSelector.onchange = async () => {
  const sound = clickSoundSelector.value;
  localStorage.setItem('metrorig_click_sound', sound);
  if (isAudioInit) {
    await syncClickSound();
  }
};

// Initialize dropdown value from localStorage
const storedClickSound = localStorage.getItem('metrorig_click_sound') || 'digital';
clickSoundSelector.value = storedClickSound;

// Initial draw and population
populatePresetsDropdown();
populateGroovesDropdown();
drawGrid();
