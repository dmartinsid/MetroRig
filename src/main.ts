import { MetronomeNode } from './audio/MetronomeNode';
import { StateManager } from './state';
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
  for (let trackId = 0; trackId < 4; trackId++) {
    const label = document.createElement('div');
    label.className = 'track-label';
    label.innerText = trackNames[trackId];
    gridContainer.appendChild(label);

    const trackSteps = state.activePreset.gridData[trackId] || new Array(16).fill(0);
    for (let step = 0; step < 16; step++) {
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
};

btnPlay.onclick = togglePlay;
btnStadiumPlay.onclick = togglePlay;

// React to trainer config updates dynamically
const formInputs = [trainerEnable, trainerStart, trainerTarget, trainerInc, trainerType, trainerVal, trainerCurve];
formInputs.forEach(el => {
  el.onchange = () => {
    syncAudioSettings();
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

// Initial draw
drawGrid();
