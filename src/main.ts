import { MetronomeNode } from './audio/MetronomeNode';
import { StateManager } from './app/stateManager';
import { Session } from './app/session';
import { browserPreferences } from './storage/preferences';
import { FACTORY_PRESETS, FACTORY_GROOVES, SPEED_TRAINER_PRESETS } from './data/factory';
import { TrainerSettings, ViewMode, startBpmFor } from './domain/preset';
import { getBeatsPerMeasure, getBeatForStep, isSustainedStep } from './domain/meter';
import { FIGURES, barCount, barSteps, patternLength } from './domain/pattern';
import { STADIUM_GROUPS, STEP_ACCENT, STEP_GHOST, STEP_NORMAL, TRACKS, groupHit } from './domain/kit';
import { isAudible } from './domain/mix';
import { formatBarStep, formatClock, formatLatency, formatSteps, formatTimer, nextDenominator } from './ui/format';
import { GENRE_TABS, SONGS, GenreTab, Song, songsForGenre } from './domain/songs';
import { CHORD_FAMILIES, CHORD_TYPES, ChordId, PAD_TIMBRES, PadFile, ROOTS, chordName, chordNotes, chordOfRoot, chordOfType, nextChord, parseTimbre, parseVolume, timbreNotes } from './domain/chords';
import workletUrl from './audio/metronome-processor?url';

declare const gsap: any;

const audioNode = new MetronomeNode();
const session = new Session({
  engine: audioNode,
  state: new StateManager(),
  prefs: browserPreferences,
  dialogs: { confirm: message => confirm(message) },
  wasmUrl: '/pkg/metrorig_audio_bg.wasm', // Compiled through Vite's public folder
  workletUrl,
});

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

// Shows the save button once the preset is modified
function showEdits() {
  // Pre-populate with the current preset name so user can build on it
  if (!presetNameInput.value) {
    presetNameInput.value = session.preset.name;
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
  session.userPresets().then(userPresets => {
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
      presetSelector.value = `factory:${session.preset.id}`;
    }
    syncStadiumPresetSelector();
  });
}

// Shows the placeholder when the active preset is not a speed trainer
function syncStadiumPresetSelector() {
  stadiumPresetSelector.value = presetSelector.value;
  if (stadiumPresetSelector.selectedIndex < 0) stadiumPresetSelector.value = '';
}

// The slider runs from 0 to 100, the engine from 0 to 1
function sendPadVolume() {
  audioNode.padVolume(Number(padVolumeSlider.value) / 100);
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

function drawFigurePalette() {
  figurePalette.innerHTML = '';
  [null, ...FIGURES].forEach(figure => {
    const btn = document.createElement('button');
    btn.className = figure === session.figure ? 'figure-btn active' : 'figure-btn';
    btn.innerText = figure ? figure.name : 'Step';
    if (figure) {
      const pattern = document.createElement('span');
      pattern.className = 'figure-pattern';
      pattern.innerText = figure.pattern.map(hit => (hit ? '●' : '·')).join('');
      btn.appendChild(pattern);
    }
    btn.onclick = () => {
      session.selectFigure(figure);
      drawFigurePalette();
    };
    figurePalette.appendChild(btn);
  });
}

function drawBarSelector() {
  barSelector.hidden = barCount(session.preset) === 1;
  barButtons.forEach((button, bar) => button.setAttribute('aria-pressed', String(bar === session.viewBar)));
}

barButtons.forEach((button, bar) => {
  button.onclick = () => session.showBar(bar);
});

function drawGrid() {
  drawBarSelector();
  gridContainer.innerHTML = '';
  const { gridData, timeSignature } = session.preset;
  const measureLength = session.preset.measureLength || 16;
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
    const silenced = !isAudible(session.mix, trackId);
    label.classList.toggle('silenced', silenced);
    label.style.gridRow = row;
    label.style.gridColumn = '1';
    gridContainer.appendChild(label);

    const allSteps = gridData[trackId] ??= new Array(patternLength(session.preset)).fill(0);
    const trackSteps = barSteps(allSteps, session.viewBar, measureLength);

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

      cell.onclick = () => session.editStep(trackId, step);

      gridContainer.appendChild(cell);
    }
  }

  updatePatternBar();
  drawBeatClock();
}

function applyTrackMix() {
  for (const { id: trackId } of TRACKS) {
    document.getElementById(`mute-${trackId}`)!.setAttribute('aria-pressed', String(session.mix.muted.has(trackId)));
    document.getElementById(`solo-${trackId}`)!.setAttribute('aria-pressed', String(session.mix.soloed.has(trackId)));
  }
  drawGrid();
}

function updatePatternBar() {
  patternName.textContent = `PAT: ${session.preset.name}`;
  patternSteps.textContent = formatSteps(patternLength(session.preset));
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
  const { gridData, timeSignature } = session.preset;
  const measureLength = session.preset.measureLength || 16;
  const beats = getBeatsPerMeasure(timeSignature, measureLength);
  clockFace.innerHTML = '';

  STADIUM_GROUPS.forEach(({ trackIds }, ring) => {
    const radius = CLOCK_RING_OUTER - CLOCK_RING_WIDTH * ring;
    const innerRadius = radius - CLOCK_RING_WIDTH + CLOCK_RING_GAP;
    const ringSteps = Array.from({ length: measureLength }, (_, step) => (groupHit(trackIds, gridData, session.playBar * measureLength + step) ? 1 : 0));
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

function resetPosition() {
  patternPosValue.textContent = formatBarStep(1, 1);
}

function renderPlayback() {
  if (!session.isPlaying) {
    btnPlay.classList.remove('playing');
    btnStadiumPlay.classList.remove('playing');
    clearInterval(timerInterval);
    drawGrid();
    resetBeatClock();
    resetPosition();
    sequencerDot.classList.remove('lit');
    bpmNumber.innerText = String(session.preset.bpm);
    stadiumBpm.innerText = session.preset.bpm.toFixed(1);
    updateSongCards();
  } else {
    drawGrid();
    btnPlay.classList.add('playing');
    btnStadiumPlay.classList.add('playing');
    sequencerDot.classList.add('lit');

    startTime = Date.now();
    updateTimers(0);
    timerInterval = setInterval(updatePracticeTimer, 1000);
    updateSongCards();
  }
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
function renderView() {
  (Object.keys(views) as ViewMode[]).forEach(mode => {
    views[mode].classList.toggle('hidden', mode !== session.view);
  });
  viewLinks.forEach(link => {
    if (link.dataset.view === session.view) link.setAttribute('aria-current', 'page');
    else link.removeAttribute('aria-current');
  });
  if (session.view === 'stadium') updateStadiumStatus(); // The Trainer form lives in the Editor
}

session.subscribe(change => {
  if (change === 'grid') drawGrid();
  else if (change === 'mix') applyTrackMix();
  else if (change === 'edits') showEdits();
  else if (change === 'playback') renderPlayback();
  else if (change === 'tick') renderTick();
  else if (change === 'preset') renderPreset();
  else if (change === 'view') renderView();
});
renderView();

// UI Event Bindings
viewLinks.forEach(link => {
  link.onclick = () => {
    session.setView(link.dataset.view as ViewMode);
    if (session.view === 'improv') loadSelectedTimbre();
  };
});

bpmSlider.oninput = () => {
  const bpm = Number(bpmSlider.value);
  bpmNumber.innerText = String(bpm);
  bpmSliderValue.innerText = String(bpm);
  stadiumBpm.innerText = bpm.toFixed(1);
  session.setBpm(bpm);
  updatePanelHeader();
};

function updateTimeSignature() {
  let num = parseInt(timeSigNum.value, 10);
  if (isNaN(num) || num < 1) num = 1;
  if (num > 16) num = 16;
  timeSigNum.value = String(num);

  const den = Number(timeSigDen.value);

  const showActiveTimeSignature = () => {
    if (!session.preset.timeSignature) return;
    const parts = session.preset.timeSignature.split('/');
    timeSigNum.value = parts[0];
    timeSigDen.value = parts[1];
  };

  const result = session.setTimeSignature(num, den);
  if (result === 'too-long') {
    alert("Time signature exceeds the maximum limit of 32 steps!");
    showActiveTimeSignature();
  } else if (result === 'declined') {
    showActiveTimeSignature();
  } else if (result === 'changed') {
    grooveSelector.value = "";
    updatePanelHeader();
  }
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

btnPlay.onclick = () => session.togglePlay();
btnStadiumPlay.onclick = () => session.togglePlay();

// React to trainer config updates dynamically
const formInputs = [trainerEnable, trainerStart, trainerTarget, trainerInc, trainerType, trainerVal, trainerCurve];
formInputs.forEach(el => {
  el.onchange = () => {
    session.setTrainer(readTrainerInputs());
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

// Draws the tick the Session took, once its sound has left the device
function renderTick() {
  const { currentBpm, activeTrackIds } = session.lastTick!;

  // Update BPM text
  bpmNumber.innerText = formatLiveBpm(Number(currentBpm));
  stadiumBpm.innerText = Number(currentBpm).toFixed(1);

  updateStadiumStatus();

  const { timeSignature } = session.preset;
  const measureLength = session.preset.measureLength || 16;
  const step = session.position.step;
  patternPosValue.textContent = formatBarStep(session.position.bar, step + 1);

  if (step === 0) footerLatency.textContent = formatLatency(session.latencyMs());

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
  const audible = ids.filter(trackId => isAudible(session.mix, trackId));
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

// Handle Preset Dropdown Selection Change
presetSelector.onchange = () => {
  syncStadiumPresetSelector();
  if (!session.loadPreset(presetSelector.value)) {
    presetSelector.value = session.selectedPresetValue;
    syncStadiumPresetSelector();
  }
};

stadiumPresetSelector.onchange = () => {
  if (!stadiumPresetSelector.value) return;
  presetSelector.value = stadiumPresetSelector.value;
  presetSelector.dispatchEvent(new Event('change'));
};

function updatePanelHeader() {
  const { name, bpm, measureLength } = session.preset;
  panelHeaderText.textContent = `${name}  ·  ${measureLengthToTimeSig(measureLength || 16)}  ·  ${bpm} BPM`;
}

function measureLengthToTimeSig(len: number): string {
  // Try to parse from the preset's timeSignature first
  if (session.preset.timeSignature && session.preset.timeSignature.includes('/')) {
    return session.preset.timeSignature;
  }
  const map: Record<number, string> = { 12: '3/4', 14: '7/8', 16: '4/4' };
  return map[len] ?? `${len} steps`;
}

// The Session loaded a preset: the controls follow it
function renderPreset() {
  const preset = session.preset;
  const ts = preset.trainerSettings;
  presetSelector.value = session.selectedPresetValue;
  syncStadiumPresetSelector();

  bpmSlider.value = String(preset.bpm);
  bpmSliderValue.innerText = String(preset.bpm);
  // During playback the engine jumps to the preset's start tempo
  const shownBpm = session.isPlaying ? startBpmFor(preset) : preset.bpm;
  bpmNumber.innerText = String(shownBpm);

  const parts = preset.timeSignature.split('/');
  timeSigNum.value = parts[0];
  timeSigDen.value = parts[1];

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
  hideSaveToast();
  
  drawGrid();
  grooveSelector.value = "";

  updatePanelHeader();

  stadiumBpm.innerText = shownBpm.toFixed(1);
  updateStadiumStatus();
  updateSongCards();
}

function hideSaveToast() {
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
}

btnSave.onclick = () => {
  session.savePreset(presetNameInput.value).then(() => {
    drawGrid(); // Cell handlers must hold the saved copy's steps
    updatePanelHeader();
    populatePresetsDropdown(session.selectedPresetValue);
    presetNameInput.value = '';
    updateSongCards();
    hideSaveToast();
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

  session.userGrooves().then(userGrooves => {
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
  session.applyGroove(val);
};

btnSaveGroove.onclick = () => {
  const name = prompt("Enter a name for your Drum Groove:");
  if (!name) return;

  session.saveGroove(name).then(() => {
    populateGroovesDropdown();
    alert(`Groove "${name}" saved successfully!`);
  });
};

clickSoundSelector.onchange = () => session.setClickSound(clickSoundSelector.value);

// Initialize dropdown value from the stored choice
clickSoundSelector.value = session.clickSound;

function mixButton(id: string, text: string, title: string, onPress: () => void) {
  const button = document.createElement('button');
  button.className = 'mix-btn';
  button.id = id;
  button.innerText = text;
  button.title = title;
  button.setAttribute('aria-pressed', 'false');
  button.onclick = onPress;
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
      mixButton(`mute-${id}`, 'M', `Mute ${name}`, () => session.toggleMute(id)),
      mixButton(`solo-${id}`, 'S', `Solo ${name}`, () => session.toggleSolo(id)),
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
  play.onclick = () => session.playSong(song);
  card.appendChild(play);

  const open = document.createElement('button');
  open.className = 'song-open';
  open.innerText = 'Open in Editor';
  open.onclick = () => {
    if (session.useSong(song)) session.setView('editor');
  };
  card.appendChild(open);
  return card;
}

function updateSongCards() {
  songGrid.querySelectorAll<HTMLElement>('.song-play').forEach(button => {
    const playing = session.isPlaying && session.preset.id === button.dataset.song;
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
    await session.startEngine();
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
footerClock.textContent = formatClock(session.sampleRate());
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
if (session.view === 'improv') loadSelectedTimbre();
