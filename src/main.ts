import { MetronomeNode } from './audio/MetronomeNode';
import { StateManager, FACTORY_PRESETS, Preset } from './state';
import workletUrl from './audio/metronome-processor?url';

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
const beatFlash = document.getElementById('beat-flash') as HTMLElement;

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

// Helper to show save button when preset is modified
function markPresetAsModified() {
  presetNameInput.style.display = 'inline-block';
  btnSave.style.display = 'inline-block';
  // Pre-populate with the current preset name so user can build on it
  if (!presetNameInput.value) {
    presetNameInput.value = state.activePreset.name;
  }
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
  syncAudioSettings();
}

function syncAudioSettings() {
  if (!isAudioInit) return;
  
  // Set active BPM
  audioNode.setBpm(state.activePreset.bpm);
  
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
function drawGrid() {
  gridContainer.innerHTML = '';
  const measureLength = state.activePreset.measureLength || 16;
  gridContainer.style.gridTemplateColumns = `auto repeat(${measureLength}, 1fr)`;

  for (let trackId = 0; trackId < 4; trackId++) {
    const label = document.createElement('div');
    label.className = 'track-label';
    label.innerText = trackNames[trackId];
    gridContainer.appendChild(label);

    const trackSteps = state.activePreset.gridData[trackId] || new Array(16).fill(0);
    for (let step = 0; step < measureLength; step++) {
      const cell = document.createElement('div');
      cell.className = 'step-cell';
      if (trackSteps[step] === 1) cell.classList.add('active');
      if (trackSteps[step] === 2) cell.classList.add('accent');
      
      cell.onclick = () => {
        // Cycle states: 0 -> 1 -> 2 -> 0 (for Clicks), 0 -> 1 -> 0 (for Drums)
        let nextState = 0;
        if (trackId === 0) {
          nextState = (trackSteps[step] + 1) % 3;
        } else {
          nextState = trackSteps[step] === 1 ? 0 : 1;
        }
        trackSteps[step] = nextState;
        
        cell.className = 'step-cell';
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
      btnPlay.innerText = 'PLAY';
      btnStadiumPlay.innerText = 'PLAY';
      clearInterval(timerInterval);
    } else {
      syncAudioSettings();
      audioNode.start();
      state.isPlaying = true;
      btnPlay.innerText = 'STOP';
      btnStadiumPlay.innerText = 'STOP';
      
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

// Handle Tick triggers from audio worklet thread
audioNode.addEventListener('tick', (e: any) => {
  const { currentBpm } = e.detail;
  
  // Update live BPM text in Stadium Mode
  stadiumBpm.innerText = Number(currentBpm).toFixed(1);
  
  if (trainerEnable.checked) {
    stadiumStatus.innerText = `Trainer Running (${trainerCurve.value})`;
  } else {
    stadiumStatus.innerText = `Trainer Off`;
  }

  // Visual Flash Pulse
  beatFlash.classList.add('flash');
  setTimeout(() => beatFlash.classList.remove('flash'), 100);
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

function loadPresetIntoUI(preset: Preset) {
  state.activePreset = JSON.parse(JSON.stringify(preset));
  const ts = state.activePreset.trainerSettings;
  
  bpmSlider.value = String(state.activePreset.bpm);
  bpmNumber.innerText = String(state.activePreset.bpm);
  
  // Sync trainer DOM inputs from preset state
  trainerEnable.checked = ts.enabled;
  trainerStart.value = String(ts.startBpm);
  trainerTarget.value = String(ts.targetBpm);
  trainerInc.value = String(ts.increment);
  trainerType.value = ts.stepType;
  trainerVal.value = String(ts.stepValue);
  trainerCurve.value = ts.curve;
  
  presetNameInput.style.display = 'none';
  presetNameInput.value = '';
  btnSave.style.display = 'none';
  
  drawGrid();
  syncAudioSettings();
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
    presetNameInput.style.display = 'none';
    btnSave.style.display = 'none';
  });
};

// Initial draw and population
populatePresetsDropdown();
drawGrid();
