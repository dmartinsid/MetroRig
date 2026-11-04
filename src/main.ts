import { MetronomeNode } from './audio/MetronomeNode';
import { StateManager } from './app/stateManager';
import { Session } from './app/session';
import { browserPreferences } from './storage/preferences';
import { startBpmFor } from './domain/preset';
import { mount as mountHeader } from './ui/header';
import { mount as mountEditor } from './ui/editor';
import { getBeatsPerMeasure, getBeatForStep, isSustainedStep } from './domain/meter';
import { STADIUM_GROUPS, groupHit } from './domain/kit';
import { isAudible } from './domain/mix';
import { formatTimer } from './ui/format';
import { GENRE_TABS, GenreTab, Song, songsForGenre } from './domain/songs';
import { CHORD_FAMILIES, CHORD_TYPES, PAD_TIMBRES, ROOTS, chordName, chordNotes, chordOfRoot, chordOfType } from './domain/chords';
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

mountHeader(session);
mountEditor(session);

// Elements
const stadiumBpm = document.getElementById('stadium-bpm') as HTMLElement;
const stadiumTimer = document.getElementById('stadium-timer') as HTMLElement;
const editorTimer = document.getElementById('editor-timer') as HTMLElement;
const stadiumStatus = document.getElementById('stadium-status') as HTMLElement;
const stadiumStatusDot = document.getElementById('stadium-status-dot') as HTMLElement;
const clockFace = document.getElementById('clock-face') as unknown as SVGGElement;
const clockHand = document.getElementById('clock-hand') as unknown as SVGGElement;
const orbs = [0, 1, 2, 3].map(i => document.getElementById(`orb-${i}`) as HTMLElement);

const trainerEnable = document.getElementById('trainer-enable') as HTMLInputElement;
const trainerStart = document.getElementById('trainer-start') as HTMLInputElement;
const trainerTarget = document.getElementById('trainer-target') as HTMLInputElement;
const trainerInc = document.getElementById('trainer-inc') as HTMLInputElement;
const trainerType = document.getElementById('trainer-type') as HTMLSelectElement;
const trainerVal = document.getElementById('trainer-val') as HTMLInputElement;

const genreTabs = document.getElementById('genre-tabs') as HTMLElement;
const songGrid = document.getElementById('song-grid') as HTMLElement;

const padStatus = document.getElementById('pad-status') as HTMLElement;
const padNotice = document.getElementById('pad-notice') as HTMLElement;
const chordRoots = document.getElementById('chord-roots') as HTMLElement;
const chordTypes = document.getElementById('chord-types') as HTMLElement;
const padStop = document.getElementById('pad-stop') as HTMLButtonElement;
const improvDot = document.getElementById('improv-dot') as HTMLElement;
const padVolumeSlider = document.getElementById('pad-volume') as HTMLInputElement;
const padVolumeValue = document.getElementById('pad-volume-value') as HTMLElement;
const padTimbreSelect = document.getElementById('pad-timbre') as HTMLSelectElement;

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

function renderPlayback() {
  if (!session.isPlaying) {
    clearInterval(timerInterval);
    drawBeatClock();
    resetBeatClock();
    stadiumBpm.innerText = session.preset.bpm.toFixed(1);
    updateSongCards();
  } else {
    drawBeatClock();

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
  if (session.view === 'stadium') updateStadiumStatus(); // The Trainer form lives in the Editor
}

function renderTempo() {
  stadiumBpm.innerText = session.preset.bpm.toFixed(1);
}

// The pattern was saved as a user preset
function renderSaved() {
  drawBeatClock();
  updateSongCards();
}

session.subscribe(change => {
  if (change === 'grid') drawBeatClock();
  else if (change === 'mix') drawBeatClock();
  else if (change === 'playback') renderPlayback();
  else if (change === 'tick') renderTick();
  else if (change === 'preset') renderPreset();
  else if (change === 'view') renderView();
  else if (change === 'improv') renderImprov();
  else if (change === 'tempo') renderTempo();
  else if (change === 'library') renderSaved();
});
renderView();

function updateStadiumStatus() {
  const bars = trainerVal.value === '1' ? 'bar' : 'bars';
  const unit = trainerType.value === 'measures' ? bars : 's';
  stadiumStatus.innerText = trainerEnable.checked
    ? `Trainer ${trainerStart.value} → ${trainerTarget.value} BPM · +${trainerInc.value} every ${trainerVal.value} ${unit}`
    : 'Trainer Off';
  stadiumStatusDot.classList.toggle('lit', trainerEnable.checked);
}

// Draws the tick the Session took, once its sound has left the device
function renderTick() {
  const { currentBpm, activeTrackIds } = session.lastTick!;

  // Update BPM text
  stadiumBpm.innerText = Number(currentBpm).toFixed(1);

  updateStadiumStatus();

  const { timeSignature } = session.preset;
  const measureLength = session.preset.measureLength || 16;
  const step = session.position.step;

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

// The Session loaded a preset: the controls follow it
function renderPreset() {
  const preset = session.preset;
  // During playback the engine jumps to the preset's start tempo
  const shownBpm = session.isPlaying ? startBpmFor(preset) : preset.bpm;

  drawBeatClock();

  stadiumBpm.innerText = shownBpm.toFixed(1);
  updateStadiumStatus();
  updateSongCards();
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

const rootButtons: HTMLButtonElement[] = [];
const typeButtons: HTMLButtonElement[] = [];

function renderImprov() {
  const mark = (button: HTMLButtonElement, sounding: boolean, selected: boolean) => {
    button.setAttribute('aria-pressed', String(sounding));
    button.dataset.state = sounding ? 'sounding' : selected ? 'selected' : '';
  };
  const { soundingChord, selectedChord } = session.improv;
  rootButtons.forEach((button, root) => mark(button, soundingChord?.root === root, selectedChord.root === root));
  typeButtons.forEach((button, type) => mark(button, soundingChord?.type === type, selectedChord.type === type));
  padStatus.textContent = soundingChord
    ? `${chordName(soundingChord.root, soundingChord.type)} · ${chordNotes(soundingChord.root, soundingChord.type).join(' ')}`
    : 'No chord playing';
  padStatus.classList.toggle('sounding', soundingChord !== null);
  padNotice.textContent = session.improv.notice();
  padNotice.hidden = !padNotice.textContent;
  padStop.disabled = !soundingChord;
  improvDot.classList.toggle('lit', soundingChord !== null);
}

padStop.onclick = () => session.stopChord();

padTimbreSelect.onchange = () => session.setTimbre(padTimbreSelect.value);

padVolumeSlider.oninput = () => {
  padVolumeValue.textContent = padVolumeSlider.value;
  session.setPadVolume(Number(padVolumeSlider.value));
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
  ROOTS.forEach((name, root) => rootButtons.push(chordButton(name, () => session.pressChord(chordOfRoot(session.improv.selectedChord, root)))));
  chordRoots.append(...rootButtons);
  CHORD_TYPES.forEach(({ suffix }, type) => typeButtons.push(chordButton(suffix || 'maj', () => session.pressChord(chordOfType(session.improv.selectedChord, type)))));
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
  padTimbreSelect.value = session.improv.timbre;
}

// Initial draw and population
drawGroovesScreen();
drawBeatClock();
drawChordSelector();
drawTimbreSelect();
padVolumeSlider.value = String(session.improv.padVolume);
padVolumeValue.textContent = padVolumeSlider.value;
renderImprov();
if (session.view === 'improv') session.loadSelectedTimbre();
