import type { Session } from '../app/session';
import { startBpmFor, type ViewMode } from '../domain/preset';
import { SONGS } from '../domain/songs';
import { formatClock, formatLatency, formatLiveBpm } from './format';
import { byId, option } from './dom';

declare const gsap: any;

// The view links, the tempo, the preset selector, the play button, the footer and the save toast
export function mount(session: Session): void {
  const viewLinks = [...document.querySelectorAll<HTMLButtonElement>('.view-link')];
  const views: Record<ViewMode, HTMLElement> = {
    editor: byId('editor-view'),
    stadium: byId('stadium-view'),
    grooves: byId('grooves-view'),
    improv: byId('improv-view'),
  };

  const bpmSlider = byId<HTMLInputElement>('bpm-slider');
  const bpmNumber = byId('bpm-number');
  const bpmSliderValue = byId('bpm-slider-value');
  const btnPlay = byId<HTMLButtonElement>('btn-play');
  const footerClock = byId('footer-clock');
  const footerLatency = byId('footer-latency');
  const saveToast = byId('save-toast');

  const presetSelector = byId<HTMLSelectElement>('preset-selector');
  const groupSignatures = byId<HTMLOptGroupElement>('group-signatures');
  const groupGenres = byId<HTMLOptGroupElement>('group-genres');
  const groupSongs = byId<HTMLOptGroupElement>('group-songs');
  const groupTrainers = byId<HTMLOptGroupElement>('group-trainers');
  const groupUser = byId<HTMLOptGroupElement>('group-user');
  const presetNameInput = byId<HTMLInputElement>('preset-name');
  const btnSave = byId<HTMLButtonElement>('btn-save');
  const clickSoundSelector = byId<HTMLSelectElement>('click-sound-selector');

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

  // Build option elements
  function populatePresetsDropdown(selectedId?: string) {
    groupSignatures.innerHTML = '';
    groupGenres.innerHTML = '';
    groupSongs.innerHTML = '';
    groupTrainers.innerHTML = '';

    session.signaturePresets.forEach(p => groupSignatures.appendChild(option(`factory:${p.id}`, p.name)));
    session.genrePresets.forEach(p => groupGenres.appendChild(option(`factory:${p.id}`, p.name)));

    SONGS.forEach(song => groupSongs.appendChild(option(`song:${song.id}`, song.title)));

    session.trainerPresets.forEach(p => groupTrainers.appendChild(option(`factory:${p.id}`, p.name)));

    // Load User Presets from database
    session.userPresets().then(userPresets => {
      groupUser.innerHTML = '';
      if (userPresets.length === 0) {
        const opt = document.createElement('option');
        opt.disabled = true;
        opt.innerText = "No custom presets";
        groupUser.appendChild(opt);
      } else {
        userPresets.forEach(p => groupUser.appendChild(option(`user:${p.id}`, p.name)));
      }
      if (selectedId) {
        presetSelector.value = selectedId;
      } else {
        presetSelector.value = `factory:${session.preset.id}`;
      }
    });
  }

  function renderView() {
    (Object.keys(views) as ViewMode[]).forEach(mode => {
      views[mode].classList.toggle('hidden', mode !== session.view);
    });
    viewLinks.forEach(link => {
      if (link.dataset.view === session.view) link.setAttribute('aria-current', 'page');
      else link.removeAttribute('aria-current');
    });
  }

  function renderPlayback() {
    if (!session.isPlaying) {
      btnPlay.classList.remove('playing');
      bpmNumber.innerText = String(session.preset.bpm);
    } else {
      btnPlay.classList.add('playing');
    }
  }

  // Draws the tick the Session took, once its sound has left the device
  function renderTick() {
    bpmNumber.innerText = formatLiveBpm(Number(session.lastTick!.currentBpm));
    if (session.position.step === 0) footerLatency.textContent = formatLatency(session.latencyMs());
  }

  // The Session loaded a preset: the controls follow it
  function renderPreset() {
    const preset = session.preset;
    presetSelector.value = session.selectedPresetValue;

    bpmSlider.value = String(preset.bpm);
    bpmSliderValue.innerText = String(preset.bpm);
    // During playback the engine jumps to the preset's start tempo
    bpmNumber.innerText = String(session.isPlaying ? startBpmFor(preset) : preset.bpm);

    presetNameInput.value = '';
    hideSaveToast();
  }

  // The tempo changed here or on the Stadium: the number and the slider follow it
  function renderTempo() {
    const bpm = String(session.preset.bpm);
    bpmSlider.value = bpm;
    bpmSliderValue.innerText = bpm;
    bpmNumber.innerText = bpm;
  }

  // The pattern was saved as a user preset
  function renderSaved() {
    populatePresetsDropdown(session.selectedPresetValue);
    presetNameInput.value = '';
    hideSaveToast();
  }

  session.subscribe(change => {
    if (change === 'edits') showEdits();
    else if (change === 'playback') renderPlayback();
    else if (change === 'tick') renderTick();
    else if (change === 'preset') renderPreset();
    else if (change === 'tempo') renderTempo();
    else if (change === 'view') renderView();
    else if (change === 'library') renderSaved();
  });
  renderView();

  viewLinks.forEach(link => {
    link.onclick = () => {
      session.setView(link.dataset.view as ViewMode);
    };
  });

  bpmSlider.oninput = () => session.setBpm(Number(bpmSlider.value));

  btnPlay.onclick = () => session.togglePlay();

  // Handle Preset Dropdown Selection Change
  presetSelector.onchange = () => {
    if (!session.loadPreset(presetSelector.value)) presetSelector.value = session.selectedPresetValue;
  };

  btnSave.onclick = () => session.savePreset(presetNameInput.value);

  clickSoundSelector.onchange = () => session.setClickSound(clickSoundSelector.value);

  // Initialize dropdown value from the stored choice
  clickSoundSelector.value = session.clickSound;

  footerClock.textContent = formatClock(session.sampleRate());
  populatePresetsDropdown();
}
