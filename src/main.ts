import { MetronomeNode } from './audio/MetronomeNode';
import { StateManager } from './app/stateManager';
import { Session } from './app/session';
import { browserPreferences } from './storage/preferences';
import { mount as mountHeader } from './ui/header';
import { mount as mountEditor } from './ui/editor';
import { mount as mountStadium } from './ui/stadium';
import { mount as mountGrooves } from './ui/grooves';
import { CHORD_FAMILIES, CHORD_TYPES, PAD_TIMBRES, ROOTS, chordName, chordNotes, chordOfRoot, chordOfType } from './domain/chords';
import workletUrl from './audio/metronome-processor?url';

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
mountStadium(session);
mountGrooves(session);

// Elements
const padStatus = document.getElementById('pad-status') as HTMLElement;
const padNotice = document.getElementById('pad-notice') as HTMLElement;
const chordRoots = document.getElementById('chord-roots') as HTMLElement;
const chordTypes = document.getElementById('chord-types') as HTMLElement;
const padStop = document.getElementById('pad-stop') as HTMLButtonElement;
const improvDot = document.getElementById('improv-dot') as HTMLElement;
const padVolumeSlider = document.getElementById('pad-volume') as HTMLInputElement;
const padVolumeValue = document.getElementById('pad-volume-value') as HTMLElement;
const padTimbreSelect = document.getElementById('pad-timbre') as HTMLSelectElement;

// Subscriptions & Events
session.subscribe(change => {
  if (change === 'improv') renderImprov();
});

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
drawChordSelector();
drawTimbreSelect();
padVolumeSlider.value = String(session.improv.padVolume);
padVolumeValue.textContent = padVolumeSlider.value;
renderImprov();
if (session.view === 'improv') session.loadSelectedTimbre();
