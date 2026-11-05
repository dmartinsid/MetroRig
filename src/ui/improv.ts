import type { Session } from '../app/session';
import { CHORD_FAMILIES, CHORD_TYPES, PAD_TIMBRES, ROOTS, chordName, chordNotes, chordOfRoot, chordOfType } from '../domain/chords';
import { byId } from './dom';

function chordButton(label: string, onclick: () => void) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'chord-btn';
  button.textContent = label;
  button.onclick = onclick;
  return button;
}

// The chord selector, the timbre select, the volume slider, the status and the notice
export function mount(session: Session): void {
  const padStatus = byId('pad-status');
  const padNotice = byId('pad-notice');
  const chordRoots = byId('chord-roots');
  const chordTypes = byId('chord-types');
  const padStop = byId<HTMLButtonElement>('pad-stop');
  const improvDot = byId('improv-dot');
  const padVolumeSlider = byId<HTMLInputElement>('pad-volume');
  const padVolumeValue = byId('pad-volume-value');
  const padTimbreSelect = byId<HTMLSelectElement>('pad-timbre');

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

  session.subscribe(change => {
    if (change === 'improv') renderImprov();
  });

  padStop.onclick = () => session.stopChord();

  padTimbreSelect.onchange = () => session.setTimbre(padTimbreSelect.value);

  padVolumeSlider.oninput = () => {
    padVolumeValue.textContent = padVolumeSlider.value;
    session.setPadVolume(Number(padVolumeSlider.value));
  };

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

  drawChordSelector();
  drawTimbreSelect();
  padVolumeSlider.value = String(session.improv.padVolume);
  padVolumeValue.textContent = padVolumeSlider.value;
  renderImprov();
  if (session.view === 'improv') session.loadSelectedTimbre();
}
