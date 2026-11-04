import { MetronomeNode, TickDetail } from './audio/MetronomeNode';
import { StateManager } from './app/stateManager';
import { browserPreferences } from './storage/preferences';
import { FACTORY_PRESETS, FACTORY_GROOVES, SPEED_TRAINER_PRESETS } from './data/factory';
import { Preset, StoredPreset, TrainerSettings, ViewMode, normalizePreset, completeKit, startBpmFor } from './domain/preset';
import { getBeatsPerMeasure, getBeatForStep, isSustainedStep, measureLengthFor } from './domain/meter';
import { FIGURES, applyFigure, barCount, barOfStep, barSteps, patternLength, stepInBar, writeBar } from './domain/pattern';
import { STADIUM_GROUPS, STEP_ACCENT, STEP_GHOST, STEP_NORMAL, TRACKS, groupHit, nextStepValue, takesOf } from './domain/kit';
import { VisualScheduler } from './visualSync';
import { audibleSteps, createTrackMix, isAudible, toggleMute, toggleSolo } from './domain/mix';
import { formatBarStep, formatClock, formatLatency, formatSteps, formatTimer, nextDenominator } from './display';
import { GENRE_TABS, SONGS, GenreTab, Song, songToPreset, songsForGenre } from './domain/songs';
import { CHORD_FAMILIES, CHORD_TYPES, ChordId, PAD_TIMBRES, PadFile, ROOTS, chordName, chordNotes, chordOfRoot, chordOfType, nextChord, parseTimbre, parseVolume, timbreNotes } from './domain/chords';
import workletUrl from './audio/metronome-processor?url';

declare const gsap: any;

const state = new StateManager();
const audioNode = new MetronomeNode();
const visualScheduler = new VisualScheduler();
const trackMix = createTrackMix();

// Elements
const viewLinks = [...document.querySelectorAll<HTMLButtonElement>('.view-link')];
const views: Record<ViewMode, HTMLElement> = {
  editor: document.getElementById('editor-view') as HTMLElement,
  stadium: document.getElementById('stadium-view') as HTMLElement,
  grooves: document.getElementById('grooves-view') as HTMLElement,
  improv: document.getElementById('improv-view') as HTMLElement,
};

const bpmSlider = document.getElementById('bpm-slider') as HTMLInputElement;
const bpmNumber = document.getElementById('bpm-number') as HTMLElement;
const bpmSliderValue = document.getElementById('bpm-slider-value') as HTMLElement;
const btnPlay = document.getElementById('btn-play') as HTMLButtonElement;
const btnStadiumPlay = document.getElementById('btn-stadium-play') as HTMLButtonElement;

const stadiumBpm = document.getElementById('stadium-bpm') as HTMLElement;
const stadiumTimer = document.getElementById('stadium-timer') as HTMLElement;
const editorTimer = document.getElementById('editor-timer') as HTMLElement;
const stadiumStatus = document.getElementById('stadium-status') as HTMLElement;
const stadiumStatusDot = document.getElementById('stadium-status-dot') as HTMLElement;
const sequencerDot = document.getElementById('sequencer-dot') as HTMLElement;
const patternName = document.getElementById('pattern-name') as HTMLElement;
const patternSteps = document.getElementById('pattern-steps') as HTMLElement;
const patternPosValue = document.getElementById('pattern-pos-value') as HTMLElement;
const footerClock = document.getElementById('footer-clock') as HTMLElement;
const footerLatency = document.getElementById('footer-latency') as HTMLElement;

const panelHeaderText = document.getElementById('panel-header-text') as HTMLElement;
const saveToast = document.getElementById('save-toast') as HTMLElement;
const trainerToggle = document.getElementById('trainer-toggle') as HTMLElement;
const trainerBody = document.getElementById('trainer-body') as HTMLElement;
const trainerChevron = document.getElementById('trainer-chevron') as HTMLElement;
const trainerDot = document.getElementById('trainer-dot') as HTMLElement;
const clockFace = document.getElementById('clock-face') as unknown as SVGGElement;
const clockHand = document.getElementById('clock-hand') as unknown as SVGGElement;
const orbs = [0, 1, 2, 3].map(i => document.getElementById(`orb-${i}`) as HTMLElement);

const trainerEnable = document.getElementById('trainer-enable') as HTMLInputElement;
const trainerStart = document.getElementById('trainer-start') as HTMLInputElement;
const trainerTarget = document.getElementById('trainer-target') as HTMLInputElement;
const trainerInc = document.getElementById('trainer-inc') as HTMLInputElement;
const trainerType = document.getElementById('trainer-type') as HTMLSelectElement;
const trainerVal = document.getElementById('trainer-val') as HTMLInputElement;
const trainerCurve = document.getElementById('trainer-curve') as HTMLSelectElement;

const trackMixCards = document.getElementById('track-mix') as HTMLElement;
const genreTabs = document.getElementById('genre-tabs') as HTMLElement;
const songGrid = document.getElementById('song-grid') as HTMLElement;
const figurePalette = document.getElementById('figure-palette') as HTMLElement;
const barSelector = document.getElementById('bar-selector') as HTMLElement;
const barButtons = [...barSelector.querySelectorAll<HTMLButtonElement>('.bar-btn')];
const gridContainer = document.getElementById('grid-container') as HTMLElement;

const presetSelector = document.getElementById('preset-selector') as HTMLSelectElement;
const groupSignatures = document.getElementById('group-signatures') as HTMLOptGroupElement;
const groupGenres = document.getElementById('group-genres') as HTMLOptGroupElement;
const groupSongs = document.getElementById('group-songs') as HTMLOptGroupElement;
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

const padStatus = document.getElementById('pad-status') as HTMLElement;
const padNotice = document.getElementById('pad-notice') as HTMLElement;
const chordRoots = document.getElementById('chord-roots') as HTMLElement;
const chordTypes = document.getElementById('chord-types') as HTMLElement;
const padStop = document.getElementById('pad-stop') as HTMLButtonElement;
const improvDot = document.getElementById('improv-dot') as HTMLElement;
const padVolumeSlider = document.getElementById('pad-volume') as HTMLInputElement;
const padVolumeValue = document.getElementById('pad-volume-value') as HTMLElement;
const padTimbreSelect = document.getElementById('pad-timbre') as HTMLSelectElement;

let hasUnsavedEdits = false;
let selectedPresetValue = 'factory:default'; // Where the selector returns when a load is declined

// Helper to show save button when preset is modified
function markPresetAsModified() {
  hasUnsavedEdits = true;
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
  groupSongs.innerHTML = '';
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

  SONGS.forEach(song => {
    const opt = document.createElement('option');
    opt.value = `song:${song.id}`;
    opt.innerText = song.title;
    groupSongs.appendChild(opt);
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

// A file that fails leaves its hit to the next loaded take, or its track silent, and the rest of the kit playing
async function loadKit() {
  const loads: { url: string; load: Promise<void> }[] = [];
  for (const track of TRACKS) {
    if (track.sample) loads.push({ url: track.sample, load: audioNode.loadSample(track.id, track.sample) });
    if (track.bank) {
      for (const { dynamic, take, url } of takesOf(track)) {
        loads.push({ url, load: audioNode.loadTake(track.id, dynamic, take, url, track.bank.trim) });
      }
    }
  }
  const results = await Promise.allSettled(loads.map(({ load }) => load));
  results.forEach((result, i) => {
    if (result.status === 'rejected') console.error(`Failed to load ${loads[i].url}:`, result.reason);
  });
}

async function launchEngine() {
  // Compile Wasm and launch worklet using assets loaded through Vite
  await audioNode.init('/pkg/metrorig_audio_bg.wasm', workletUrl);
  sendPadVolume();
}

// The slider runs from 0 to 100, the engine from 0 to 1
function sendPadVolume() {
  audioNode.padVolume(Number(padVolumeSlider.value) / 100);
}

// Runs once; a failure clears it, so the next use retries
let enginePromise: Promise<void> | null = null;

function startEngine(): Promise<void> {
  enginePromise ??= launchEngine().catch(err => {
    enginePromise = null;
    throw err;
  });
  return enginePromise;
}

// Initialize Metronome Engine
let isAudioInit = false;
async function initAudio() {
  if (isAudioInit) return;
  await startEngine();

  await loadKit();

  isAudioInit = true;
  await syncClickSound(); // Wait for click sound loading
  syncAudioSettings();
}

// Sends the start tempo, so it runs only on Play and preset load
function syncAudioSettings() {
  if (!isAudioInit) return;

  audioNode.setBpm(startBpmFor(state.activePreset));
  syncMeterAndGrid();
  audioNode.replaceTrainer(readTrainerInputs()); // Applies now
}

// Sends everything but BPM, so a change during playback keeps the live tempo.
// A running Trainer takes the change on beat 1.
function syncPlaybackSettings() {
  if (!isAudioInit) return;

  syncMeterAndGrid();
  audioNode.setTrainer(readTrainerInputs());
}

function syncMeterAndGrid() {
  // Set measure length
  audioNode.setMeasureLength(state.activePreset.measureLength || 16);
  audioNode.setBars(barCount(state.activePreset));

  // Update active tracks
  TRACKS.forEach(track => sendTrack(track.id));
}

// The one path to the engine: silenced tracks play an empty grid, the preset keeps its steps
function sendTrack(trackId: number) {
  const steps = state.activePreset.gridData[trackId] || new Array(patternLength(state.activePreset)).fill(0);
  audioNode.updateGrid(trackId, audibleSteps(trackMix, trackId, steps));
}

function readTrainerInputs(): TrainerSettings {
  return {
    enabled: trainerEnable.checked,
    startBpm: Number(trainerStart.value),
    targetBpm: Number(trainerTarget.value),
    increment: Number(trainerInc.value),
    stepType: trainerType.value as 'measures' | 'seconds',
    stepValue: Number(trainerVal.value),
    curve: trainerCurve.value as 'stepped' | 'smooth'
  };
}

// Draw Sequencer Grid
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

// The bar the Editor shows, and the bar in play, which is the first one when stopped
let viewBar = 0;
let playBar = 0;

function drawBarSelector() {
  barSelector.hidden = barCount(state.activePreset) === 1;
  barButtons.forEach((button, bar) => button.setAttribute('aria-pressed', String(bar === viewBar)));
}

barButtons.forEach((button, bar) => {
  button.onclick = () => {
    viewBar = bar;
    drawGrid();
  };
});

function drawGrid() {
  drawBarSelector();
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

  const beatSubLabel = document.createElement('div');
  beatSubLabel.className = 'step-count-label';
  beatSubLabel.innerText = 'BEAT/SUB';
  beatSubLabel.style.gridRow = '1';
  beatSubLabel.style.gridColumn = '1';
  gridContainer.appendChild(beatSubLabel);

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

  for (const [index, { id: trackId, name }] of TRACKS.entries()) {
    const row = String(index + 2); // Ids are not in grid order

    // Label cell
    const label = document.createElement('div');
    label.className = 'track-label';
    label.setAttribute('data-track', String(trackId));
    label.innerText = name;
    const silenced = !isAudible(trackMix, trackId);
    label.classList.toggle('silenced', silenced);
    label.style.gridRow = row;
    label.style.gridColumn = '1';
    gridContainer.appendChild(label);

    const allSteps = gridData[trackId] ??= new Array(patternLength(state.activePreset)).fill(0);
    const trackSteps = barSteps(allSteps, viewBar, measureLength);

    for (let step = 0; step < measureLength; step++) {
      const cell = document.createElement('div');
      cell.className = silenced ? 'step-cell silenced' : 'step-cell';
      cell.setAttribute('data-track', String(trackId));
      cell.style.gridRow = row;
      cell.style.gridColumn = String(stepColumns[step]);

      if (trackSteps[step] === STEP_NORMAL) {
        cell.classList.add('active');
        cell.innerText = '●';
      }
      if (trackSteps[step] === STEP_ACCENT) {
        cell.classList.add('accent');
        cell.innerText = '▲';
      }
      if (trackSteps[step] === STEP_GHOST) {
        cell.classList.add('ghost');
        cell.innerText = '•';
      }
      if (isSustainedStep(trackSteps, step, measureLength, beats)) cell.classList.add('sustain');

      cell.onclick = () => {
        if (activeFigure) {
          applyFigure(trackSteps, step, activeFigure.pattern, measureLength);
        } else {
          trackSteps[step] = nextStepValue(trackId, trackSteps[step]);
        }
        writeBar(allSteps, viewBar, measureLength, trackSteps);

        if (isAudioInit) sendTrack(trackId);
        drawGrid();
        markPresetAsModified();
      };

      gridContainer.appendChild(cell);
    }
  }

  updatePatternBar();
  drawBeatClock();
}

function applyTrackMix() {
  for (const { id: trackId } of TRACKS) {
    document.getElementById(`mute-${trackId}`)!.setAttribute('aria-pressed', String(trackMix.muted.has(trackId)));
    document.getElementById(`solo-${trackId}`)!.setAttribute('aria-pressed', String(trackMix.soloed.has(trackId)));
    if (isAudioInit) sendTrack(trackId);
  }
  drawGrid();
}

function updatePatternBar() {
  patternName.textContent = `PAT: ${state.activePreset.name}`;
  patternSteps.textContent = formatSteps(patternLength(state.activePreset));
}

// Draw Stadium beat clock: one ring per group, one slice per step, 12 o'clock is step 0
const SVG_NS = 'http://www.w3.org/2000/svg';
const CLOCK_RING_OUTER = 80;
const CLOCK_RING_WIDTH = 15;
const CLOCK_RING_GAP = 1.2;
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

  STADIUM_GROUPS.forEach(({ trackIds }, ring) => {
    const radius = CLOCK_RING_OUTER - CLOCK_RING_WIDTH * ring;
    const innerRadius = radius - CLOCK_RING_WIDTH + CLOCK_RING_GAP;
    const ringSteps = Array.from({ length: measureLength }, (_, step) => (groupHit(trackIds, gridData, playBar * measureLength + step) ? 1 : 0));
    for (let step = 0; step < measureLength; step++) {
      // A slice can't span the full circle, which a single-step measure would need
      const [x1, y1] = clockPoint(step / measureLength, radius);
      const [x2, y2] = clockPoint((step + 1) / measureLength - 0.0001, radius);
      const [x3, y3] = clockPoint((step + 1) / measureLength - 0.0001, innerRadius);
      const [x4, y4] = clockPoint(step / measureLength, innerRadius);
      const largeArc = measureLength === 1 ? 1 : 0;

      const slice = document.createElementNS(SVG_NS, 'path');
      slice.setAttribute('d', `M ${x1} ${y1} A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2} L ${x3} ${y3} A ${innerRadius} ${innerRadius} 0 ${largeArc} 0 ${x4} ${y4} Z`);
      const sustained = isSustainedStep(ringSteps, step, measureLength, beats);
      slice.setAttribute('class', ringSteps[step] > 0 ? 'clock-slice on' : sustained ? 'clock-slice sustain' : 'clock-slice');
      slice.setAttribute('data-track', String(ring));
      clockFace.appendChild(slice);
    }
  });

  // Drawn over the slices, whose own stroke would thin the gap between the two continuous rings
  STADIUM_GROUPS.slice(1).forEach((_, index) => {
    const separator = document.createElementNS(SVG_NS, 'circle');
    separator.setAttribute('r', String(CLOCK_RING_OUTER - CLOCK_RING_WIDTH * (index + 1) + CLOCK_RING_GAP / 2));
    separator.setAttribute('class', 'clock-ring-separator');
    clockFace.appendChild(separator);
  });

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
let currentBar = 1;
let lastStep = -1;

function resetPosition() {
  currentBar = 1;
  lastStep = -1;
  patternPosValue.textContent = formatBarStep(1, 1);
}

// The first Play waits for the kit to load, and a song pressed meanwhile must not stop it
let isStarting = false;

function togglePlay() {
  isStarting = !state.isPlaying;
  initAudio().then(() => {
    if (state.isPlaying) {
      audioNode.stop();
      state.isPlaying = false;
      btnPlay.classList.remove('playing');
      btnStadiumPlay.classList.remove('playing');
      clearInterval(timerInterval);
      visualScheduler.cancelAll();
      viewBar = 0;
      playBar = 0;
      drawGrid();
      resetBeatClock();
      resetPosition();
      sequencerDot.classList.remove('lit');
      bpmNumber.innerText = String(state.activePreset.bpm);
      stadiumBpm.innerText = state.activePreset.bpm.toFixed(1);
      updateSongCards();
    } else {
      viewBar = 0; // A bar pressed while stopped gives way to the first bar in play
      drawGrid();
      syncAudioSettings();
      audioNode.start();
      state.isPlaying = true;
      btnPlay.classList.add('playing');
      btnStadiumPlay.classList.add('playing');
      sequencerDot.classList.add('lit');

      startTime = Date.now();
      updateTimers(0);
      timerInterval = setInterval(updatePracticeTimer, 1000);
      updateSongCards();
    }
  }).finally(() => {
    isStarting = false;
  });
}

function updatePracticeTimer() {
  updateTimers(Math.floor((Date.now() - startTime) / 1000));
}

function updateTimers(seconds: number) {
  const time = formatTimer(seconds);
  editorTimer.innerText = time;
  stadiumTimer.innerText = time;
}

// Subscriptions & Events
state.subscribe((s) => {
  // Sync View Mode
  (Object.keys(views) as ViewMode[]).forEach(mode => {
    views[mode].classList.toggle('hidden', mode !== s.activeViewMode);
  });
  viewLinks.forEach(link => {
    if (link.dataset.view === s.activeViewMode) link.setAttribute('aria-current', 'page');
    else link.removeAttribute('aria-current');
  });
  if (s.activeViewMode === 'stadium') updateStadiumStatus(); // The Trainer form lives in the Editor
});

// UI Event Bindings
viewLinks.forEach(link => {
  link.onclick = () => {
    state.setViewMode(link.dataset.view as ViewMode);
    if (state.activeViewMode === 'improv') loadSelectedTimbre();
  };
});

bpmSlider.oninput = () => {
  const bpm = Number(bpmSlider.value);
  bpmNumber.innerText = String(bpm);
  bpmSliderValue.innerText = String(bpm);
  stadiumBpm.innerText = bpm.toFixed(1);
  state.activePreset.bpm = bpm;
  if (isAudioInit) audioNode.setBpm(bpm);
  markPresetAsModified();
  updatePanelHeader();
};

function updateTimeSignature() {
  let num = parseInt(timeSigNum.value, 10);
  if (isNaN(num) || num < 1) num = 1;
  if (num > 16) num = 16;
  timeSigNum.value = String(num);

  const den = Number(timeSigDen.value);
  const sigStr = `${num}/${den}`;
  
  const measureLength = measureLengthFor(num, den);

  const showActiveTimeSignature = () => {
    if (!state.activePreset.timeSignature) return;
    const parts = state.activePreset.timeSignature.split('/');
    timeSigNum.value = parts[0];
    timeSigDen.value = parts[1];
  };

  // Clamp to 32 steps max
  if (measureLength > 32) {
    alert("Time signature exceeds the maximum limit of 32 steps!");
    showActiveTimeSignature();
    return;
  }

  if (barCount(state.activePreset) > 1) {
    if (sigStr === state.activePreset.timeSignature) return;
    if (!confirm('Changing the time signature keeps only bar 1. Continue?')) {
      showActiveTimeSignature();
      return;
    }
  }

  grooveSelector.value = "";

  visualScheduler.cancelAll(); // Ticks of the old bar length must not draw on the new one
  const oldLength = state.activePreset.measureLength || 16;
  state.activePreset.timeSignature = sigStr;
  state.activePreset.measureLength = measureLength;
  state.activePreset.bars = 1;
  viewBar = 0;
  playBar = 0;

  // Resize gridData tracks to match the new length
  for (const { id: trackId } of TRACKS) {
    const oldSteps = barSteps(state.activePreset.gridData[trackId] || [], 0, oldLength);
    const newSteps = new Array(measureLength).fill(0);
    for (let i = 0; i < Math.min(oldSteps.length, measureLength); i++) {
      newSteps[i] = oldSteps[i];
    }
    state.activePreset.gridData[trackId] = newSteps;
  }

  drawGrid();
  syncPlaybackSettings();
  markPresetAsModified();

  updatePanelHeader();
}

timeSigNum.onchange = updateTimeSignature;
timeSigDen.onchange = updateTimeSignature;

// A stepper at its stop changes nothing, so it must not count as an edit
function stepNumerator(delta: number) {
  const numerator = Number(timeSigNum.value);
  const next = Math.min(16, Math.max(1, numerator + delta));
  if (next === numerator) return;
  timeSigNum.value = String(next);
  updateTimeSignature();
}

function stepDenominator(direction: 1 | -1) {
  const denominator = Number(timeSigDen.value);
  const next = nextDenominator(denominator, direction);
  if (next === denominator) return;
  timeSigDen.value = String(next);
  updateTimeSignature();
}

(document.getElementById('time-sig-num-up') as HTMLButtonElement).onclick = () => stepNumerator(1);
(document.getElementById('time-sig-num-down') as HTMLButtonElement).onclick = () => stepNumerator(-1);
(document.getElementById('time-sig-den-up') as HTMLButtonElement).onclick = () => stepDenominator(1);
(document.getElementById('time-sig-den-down') as HTMLButtonElement).onclick = () => stepDenominator(-1);

btnPlay.onclick = togglePlay;
btnStadiumPlay.onclick = togglePlay;

// React to trainer config updates dynamically
const formInputs = [trainerEnable, trainerStart, trainerTarget, trainerInc, trainerType, trainerVal, trainerCurve];
formInputs.forEach(el => {
  el.onchange = () => {
    // Sync DOM trainer values back into state so saves are accurate
    state.activePreset.trainerSettings = readTrainerInputs();
    syncPlaybackSettings();
    markPresetAsModified();
  };
});

let trainerOpen = true;
gsap.set(trainerChevron, { rotation: 180 });
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
  stadiumStatusDot.classList.toggle('lit', trainerEnable.checked);
}

// Stepped runs read as integers; Smooth runs show their real value
function formatLiveBpm(bpm: number): string {
  return Number.isInteger(bpm) ? String(bpm) : bpm.toFixed(1);
}

// Draws one tick once its sound has left the device
function renderTick({ beatIndex, currentBpm, activeTrackIds }: TickDetail) {
  // Ticks still in flight after stop must not restart anything
  if (!state.isPlaying) return;
  // The engine may not have taken a shorter pattern yet
  if (beatIndex >= patternLength(state.activePreset)) return;

  // Update BPM text
  bpmNumber.innerText = formatLiveBpm(Number(currentBpm));
  stadiumBpm.innerText = Number(currentBpm).toFixed(1);

  updateStadiumStatus();

  const { timeSignature } = state.activePreset;
  const measureLength = state.activePreset.measureLength || 16;
  const step = stepInBar(beatIndex, measureLength);

  // A bar pressed during playback holds until here
  const bar = barOfStep(beatIndex, measureLength);
  if (bar !== playBar) {
    playBar = bar;
    viewBar = bar;
    drawGrid();
  }

  // Steps only rise within a bar, so anything else is a wrap to the next one
  if (step <= lastStep) currentBar++;
  lastStep = step;
  patternPosValue.textContent = formatBarStep(currentBar, step + 1);

  if (step === 0) footerLatency.textContent = formatLatency(audioNode.visualDelayMs());

  // Beat clock
  const beats = getBeatsPerMeasure(timeSignature, measureLength);
  const stepDuration = 60 / Number(currentBpm) / 4; // Engine runs 4 steps per BPM beat
  highlightBeat(getBeatForStep(step, measureLength, beats));
  gsap.killTweensOf(clockHand);
  gsap.fromTo(clockHand,
    { rotation: (step / measureLength) * 360, svgOrigin: '0 0' },
    { rotation: ((step + 1) / measureLength) * 360, duration: stepDuration, ease: 'none' }
  );

  // Orbs keep a steady color and only nudge in size, avoiding luminance flashes
  const ids: number[] = activeTrackIds ?? [];
  const audible = ids.filter(trackId => isAudible(trackMix, trackId));
  STADIUM_GROUPS.forEach(({ trackIds }, group) => {
    if (!trackIds.some(trackId => audible.includes(trackId))) return;
    const orb = orbs[group];
    gsap.killTweensOf(orb);
    gsap.fromTo(orb,
      { scale: 1.15 },
      { scale: 1.0, duration: 0.2, ease: 'power2.out' }
    );
  });
}

// Handle Tick triggers from audio worklet thread
audioNode.addEventListener('tick', (e) => {
  const detail = (e as CustomEvent<TickDetail>).detail;
  visualScheduler.schedule(() => renderTick(detail), audioNode.visualDelayMs());
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
  } else if (val.startsWith('song:')) {
    const song = SONGS.find(s => s.id === val.replace('song:', ''));
    if (song && !useSong(song)) {
      presetSelector.value = selectedPresetValue;
      syncStadiumPresetSelector();
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

function updatePanelHeader() {
  const { name, bpm, measureLength } = state.activePreset;
  panelHeaderText.textContent = `${name}  ·  ${measureLengthToTimeSig(measureLength || 16)}  ·  ${bpm} BPM`;
}

function measureLengthToTimeSig(len: number): string {
  // Try to parse from state.activePreset.timeSignature first
  if (state.activePreset.timeSignature && state.activePreset.timeSignature.includes('/')) {
    return state.activePreset.timeSignature;
  }
  const map: Record<number, string> = { 12: '3/4', 14: '7/8', 16: '4/4' };
  return map[len] ?? `${len} steps`;
}

function loadPresetIntoUI(storedPreset: StoredPreset) {
  visualScheduler.cancelAll(); // Ticks of the previous preset must not overwrite this one
  const preset = completeKit(normalizePreset(storedPreset));
  state.activePreset = preset;
  viewBar = 0;
  playBar = 0;
  const ts = preset.trainerSettings;
  
  bpmSlider.value = String(state.activePreset.bpm);
  bpmSliderValue.innerText = String(state.activePreset.bpm);
  // During playback the engine jumps to the preset's start tempo
  const shownBpm = state.isPlaying ? startBpmFor(preset) : preset.bpm;
  bpmNumber.innerText = String(shownBpm);
  
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
  // A pattern of 4 bars starts from its first bar, without touching the pulse
  if (isAudioInit && state.isPlaying && barCount(preset) > 1) audioNode.restartPattern();
  grooveSelector.value = "";

  updatePanelHeader();

  stadiumBpm.innerText = shownBpm.toFixed(1);
  updateStadiumStatus();
  hasUnsavedEdits = false;
  selectedPresetValue = presetSelector.value;
  updateSongCards();
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
    bars: barCount(state.activePreset),
    gridData: JSON.parse(JSON.stringify(state.activePreset.gridData)),
    trainerSettings: JSON.parse(JSON.stringify(state.activePreset.trainerSettings))
  };
  
  state.savePreset(newPreset).then(() => {
    state.activePreset = newPreset;
    drawGrid(); // Cell handlers must hold the saved copy's steps
    updatePanelHeader();
    populatePresetsDropdown(`user:${id}`);
    presetNameInput.value = '';
    hasUnsavedEdits = false;
    selectedPresetValue = `user:${id}`;
    updateSongCards();
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
    for (const { id: trackId } of TRACKS.slice(1)) {
      const srcPattern = tracks[trackId] || [];
      const destPattern = new Array(activeLen).fill(0);
      for (let i = 0; i < activeLen; i++) {
        destPattern[i] = srcPattern[i % length] || 0;
      }
      writeBar(state.activePreset.gridData[trackId] ??= [], viewBar, activeLen, destPattern);
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
  for (const { id: trackId } of TRACKS.slice(1)) {
    const srcTrack = barSteps(state.activePreset.gridData[trackId] || [], viewBar, activeLen);
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
  browserPreferences.set('clickSound', sound);
  if (isAudioInit) {
    try {
      await syncClickSound();
    } catch (err) {
      console.error("Failed to sync click sound on selector change:", err);
    }
  }
};

// Initialize dropdown value from localStorage
const storedClickSound = browserPreferences.get('clickSound') || 'digital';
clickSoundSelector.value = storedClickSound;

function mixButton(id: string, text: string, title: string, onPress: () => void) {
  const button = document.createElement('button');
  button.className = 'mix-btn';
  button.id = id;
  button.innerText = text;
  button.title = title;
  button.setAttribute('aria-pressed', 'false');
  button.onclick = () => {
    onPress();
    applyTrackMix();
  };
  return button;
}

function drawMixCards() {
  TRACKS.forEach(({ id, name, label }) => {
    const card = document.createElement('div');
    card.className = 'track-mix-card card';
    card.setAttribute('data-track', String(id));
    const trackName = document.createElement('span');
    trackName.className = 'track-mix-name';
    trackName.innerText = label;
    card.append(
      trackName,
      mixButton(`mute-${id}`, 'M', `Mute ${name}`, () => toggleMute(trackMix, id)),
      mixButton(`solo-${id}`, 'S', `Solo ${name}`, () => toggleSolo(trackMix, id)),
    );
    trackMixCards.appendChild(card);
  });
}

let activeGenre: GenreTab = 'All';

function drawGenreTabs() {
  genreTabs.innerHTML = '';
  GENRE_TABS.forEach(genre => {
    const tab = document.createElement('button');
    tab.className = 'genre-tab';
    tab.innerText = genre;
    tab.setAttribute('aria-pressed', String(genre === activeGenre));
    tab.onclick = () => {
      activeGenre = genre;
      drawGroovesScreen();
    };
    genreTabs.appendChild(tab);
  });
}

function songCard(song: Song) {
  const card = document.createElement('article');
  card.className = 'song-card card';
  card.setAttribute('data-song', song.id);

  const texts: [string, string][] = [
    ['song-title', song.title],
    ['song-artist', song.artist],
    ['song-section', song.section],
    ['song-bpm', `${song.bpm} BPM`],
    ['song-meter', song.timeSignature],
  ];
  texts.forEach(([className, text]) => {
    const line = document.createElement('span');
    line.className = className;
    line.innerText = text;
    card.appendChild(line);
  });

  const play = document.createElement('button');
  play.className = 'song-play';
  play.setAttribute('data-song', song.id);
  play.setAttribute('aria-label', `Play ${song.title}`);
  play.onclick = () => playSong(song);
  card.appendChild(play);

  const open = document.createElement('button');
  open.className = 'song-open';
  open.innerText = 'Open in Editor';
  open.onclick = () => {
    if (useSong(song)) state.setViewMode('editor');
  };
  card.appendChild(open);
  return card;
}

function isSongLoaded(song: Song) {
  return state.activePreset.id === song.id;
}

// Loads a song unless the user keeps the edits it would replace
function useSong(song: Song): boolean {
  if (isSongLoaded(song)) return true;
  if (hasUnsavedEdits && !confirm(`Discard your unsaved changes and load ${song.title}?`)) return false;
  presetSelector.value = `song:${song.id}`;
  syncStadiumPresetSelector();
  loadPresetIntoUI(songToPreset(song));
  return true;
}

function playSong(song: Song) {
  const loaded = isSongLoaded(song);
  if (!useSong(song)) return;
  if (loaded || !(state.isPlaying || isStarting)) togglePlay(); // Playing another song carries on at its tempo
}

function updateSongCards() {
  songGrid.querySelectorAll<HTMLElement>('.song-play').forEach(button => {
    const playing = state.isPlaying && state.activePreset.id === button.dataset.song;
    button.innerText = playing ? '■' : '▶';
  });
}

function drawGroovesScreen() {
  drawGenreTabs();
  songGrid.innerHTML = '';
  songsForGenre(activeGenre).forEach(song => songGrid.appendChild(songCard(song)));
  updateSongCards();
}

// What the engine holds, which is what the screen shows
let soundingChord: ChordId | null = null;
// Where the clicks lead, ahead of soundingChord while the engine starts, so the last click wins
let clickedChord: ChordId | null = null;
let audioFailed = false;
let selectedChord: ChordId = { root: 0, type: 0 }; // What a click on a root or type keeps the other half of
const rootButtons: HTMLButtonElement[] = [];
const typeButtons: HTMLButtonElement[] = [];

async function engineReady(): Promise<boolean> {
  try {
    await startEngine();
    audioFailed = false;
    return true;
  } catch {
    audioFailed = true;
    return false;
  }
}

function selectedTimbre() {
  return parseTimbre(padTimbreSelect.value);
}

function playChord({ root, type }: ChordId) {
  audioNode.padPlay(timbreNotes(root, type, selectedTimbre()), selectedTimbre());
}

function settleChord() {
  if (clickedChord !== soundingChord) {
    soundingChord = clickedChord;
    if (soundingChord) playChord(soundingChord);
    else audioNode.padStop();
  }
  renderImprov();
}

async function pressChord(chord: ChordId) {
  audioNode.resumeContext(); // A browser only honours it within the click
  selectedChord = chord;
  clickedChord = nextChord(clickedChord, chord);
  renderImprov();
  if (!(await engineReady())) clickedChord = null;
  settleChord();
}

// Per timbre: every file at first, then only the ones that failed
const padLoads = PAD_TIMBRES.map(({ files }) => ({ toLoad: files, failed: 0, isLoading: false }));
let padLoadQueue = Promise.resolve();

// One file at a time across the timbres, so no audio block carries more than one copy
function loadTimbre(timbre: number) {
  const load = padLoads[timbre];
  if (load.isLoading) return;
  load.isLoading = true;
  padLoadQueue = padLoadQueue.then(async () => {
    const failed: PadFile[] = [];
    audioNode.padLoadBegin(timbre);
    for (const file of load.toLoad) {
      try {
        await audioNode.padLoad(timbre, file.key, file.url, file.loopStart, file.loopEnd);
      } catch (err) {
        console.error(`Failed to load ${file.url}:`, err);
        failed.push(file);
      }
    }
    audioNode.padLoadEnd(timbre);
    load.toLoad = failed;
    load.failed = failed.length;
    load.isLoading = false;
    renderImprov();
  });
}

// Makes no sound, and leaves the kit to Play
async function loadSelectedTimbre() {
  if (await engineReady()) loadTimbre(selectedTimbre());
  renderImprov();
}

function padNoticeText() {
  if (audioFailed) return 'Audio unavailable';
  const timbre = selectedTimbre();
  const { failed } = padLoads[timbre];
  if (failed === 0) return '';
  return failed === PAD_TIMBRES[timbre].files.length ? 'Samples unavailable · synth only' : 'Some samples unavailable';
}

function renderImprov() {
  const mark = (button: HTMLButtonElement, sounding: boolean, selected: boolean) => {
    button.setAttribute('aria-pressed', String(sounding));
    button.dataset.state = sounding ? 'sounding' : selected ? 'selected' : '';
  };
  rootButtons.forEach((button, root) => mark(button, soundingChord?.root === root, selectedChord.root === root));
  typeButtons.forEach((button, type) => mark(button, soundingChord?.type === type, selectedChord.type === type));
  padStatus.textContent = soundingChord
    ? `${chordName(soundingChord.root, soundingChord.type)} · ${chordNotes(soundingChord.root, soundingChord.type).join(' ')}`
    : 'No chord playing';
  padStatus.classList.toggle('sounding', soundingChord !== null);
  padNotice.textContent = padNoticeText();
  padNotice.hidden = !padNotice.textContent;
  padStop.disabled = !soundingChord;
  improvDot.classList.toggle('lit', soundingChord !== null);
}

padStop.onclick = () => {
  clickedChord = null;
  settleChord();
};

// The engine crossfades to the same chord in the new timbre. With no chord, the next one takes it
padTimbreSelect.onchange = () => {
  browserPreferences.set('padTimbre', padTimbreSelect.value);
  if (soundingChord) playChord(soundingChord);
  loadSelectedTimbre();
};

padVolumeSlider.oninput = () => {
  padVolumeValue.textContent = padVolumeSlider.value;
  browserPreferences.set('padVolume', padVolumeSlider.value);
  sendPadVolume();
};

function chordButton(label: string, onclick: () => void) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'chord-btn';
  button.textContent = label;
  button.onclick = onclick;
  return button;
}

function drawChordSelector() {
  ROOTS.forEach((name, root) => rootButtons.push(chordButton(name, () => pressChord(chordOfRoot(selectedChord, root)))));
  chordRoots.append(...rootButtons);
  CHORD_TYPES.forEach(({ suffix }, type) => typeButtons.push(chordButton(suffix || 'maj', () => pressChord(chordOfType(selectedChord, type)))));
  CHORD_FAMILIES.forEach(family => {
    const section = document.createElement('section');
    section.className = 'chord-family';
    const heading = document.createElement('h2');
    heading.textContent = family;
    const buttons = document.createElement('div');
    buttons.className = 'chord-family-types';
    buttons.append(...typeButtons.filter((_, type) => CHORD_TYPES[type].family === family));
    section.append(heading, buttons);
    chordTypes.appendChild(section);
  });
}

function drawTimbreSelect() {
  PAD_TIMBRES.forEach(({ name }) => {
    const option = document.createElement('option');
    option.value = name;
    option.textContent = name;
    padTimbreSelect.appendChild(option);
  });
  padTimbreSelect.value = PAD_TIMBRES[parseTimbre(browserPreferences.get('padTimbre'))].name;
}

// Initial draw and population
footerClock.textContent = formatClock(audioNode.sampleRate());
populatePresetsDropdown();
populateGroovesDropdown();
drawMixCards();
drawGroovesScreen();
drawFigurePalette();
drawGrid();
drawChordSelector();
drawTimbreSelect();
padVolumeSlider.value = String(parseVolume(browserPreferences.get('padVolume')));
padVolumeValue.textContent = padVolumeSlider.value;
renderImprov();
if (state.activeViewMode === 'improv') loadSelectedTimbre();
