import type { Session, TrainerFields } from '../app/session';
import { clampNumerator, isSustainedStep, nextDenominator, timeSignatureOf } from '../domain/meter';
import { FIGURES, barCount } from '../domain/pattern';
import type { TrainerSettings } from '../domain/preset';
import { STEP_ACCENT, STEP_GHOST, STEP_NORMAL, TRACKS } from '../domain/kit';
import { isAudible } from '../domain/mix';
import { barBeatCells, barOffset, isTupletSignature, patternCells } from '../domain/layout';
import { formatBarStep, formatSteps, formatTimer } from './format';
import { byId, option } from './dom';

declare const gsap: any;

const SUBDIVISION_LABELS: Record<number, string[]> = { 2: ['', '&'], 4: ['', 'e', '&', 'a'] };

// The grid, the figure palette, the bar selector, the time signature, the Trainer form, the mix cards and the grooves dropdown
export function mount(session: Session): void {
  const sequencerDot = byId('sequencer-dot');
  const editorTimer = byId('editor-timer');
  const panelHeaderText = byId('panel-header-text');
  const patternName = byId('pattern-name');
  const patternSteps = byId('pattern-steps');
  const patternPosValue = byId('pattern-pos-value');

  const trainerToggle = byId('trainer-toggle');
  const trainerBody = byId('trainer-body');
  const trainerChevron = byId('trainer-chevron');
  const trainerDot = byId('trainer-dot');
  const trainerEnable = byId<HTMLInputElement>('trainer-enable');
  const trainerStart = byId<HTMLInputElement>('trainer-start');
  const trainerTarget = byId<HTMLInputElement>('trainer-target');
  const trainerInc = byId<HTMLInputElement>('trainer-inc');
  const trainerType = byId<HTMLSelectElement>('trainer-type');
  const trainerVal = byId<HTMLInputElement>('trainer-val');
  const trainerCurve = byId<HTMLSelectElement>('trainer-curve');

  const trackMixCards = byId('track-mix');
  const figurePalette = byId('figure-palette');
  const barSelector = byId('bar-selector');
  const barButtons = [...barSelector.querySelectorAll<HTMLButtonElement>('.bar-btn')];
  const gridContainer = byId('grid-container');
  const gridScroller = gridContainer.parentElement!;

  const timeSigNum = byId<HTMLInputElement>('time-sig-num');
  const timeSigDen = byId<HTMLSelectElement>('time-sig-den');
  const grooveSelector = byId<HTMLSelectElement>('groove-selector');
  const btnSaveGroove = byId<HTMLButtonElement>('btn-save-groove');

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

  function readTrainerFields(): TrainerFields {
    return {
      enabled: trainerEnable.checked,
      startBpm: trainerStart.value,
      targetBpm: trainerTarget.value,
      increment: trainerInc.value,
      stepType: trainerType.value,
      stepValue: trainerVal.value,
    };
  }

  function drawFigurePalette() {
    figurePalette.innerHTML = '';
    [null, ...FIGURES].forEach(figure => {
      const btn = document.createElement('button');
      btn.className = figure === session.figure ? 'figure-btn active' : 'figure-btn';
      if (figure && figure.cells !== 4) btn.dataset.tuplet = String(figure.cells);
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
    updateFigureAvailability();
  }

  // Tuplets fill a quarter note, so their figures are off outside /4
  function updateFigureAvailability() {
    const off = !isTupletSignature(session.preset.timeSignature);
    figurePalette.querySelectorAll<HTMLButtonElement>('.figure-btn[data-tuplet]').forEach(btn => { btn.disabled = off; });
  }

  function drawBarSelector() {
    barSelector.hidden = barCount(session.preset) === 1;
    barButtons.forEach((button, bar) => button.setAttribute('aria-pressed', String(bar === session.viewBar)));
  }

  function drawGrid() {
    drawBarSelector();
    updateFigureAvailability();
    gridContainer.innerHTML = '';
    const { gridData } = session.preset;
    const beatCells = barBeatCells(session.preset, session.viewBar);
    const straight = barBeatCells({ ...session.preset, beatCells: undefined }, session.viewBar);
    const hasTuplet = beatCells.some((cells, beat) => cells !== straight[beat]);
    // A bar with a tuplet lays 12 sub-columns per beat and each cell spans 12 / cells of them,
    // so 3 or 6 cells take a straight beat's width; any other bar keeps one column per cell
    const subColumns = (cells: number) => (hasTuplet ? 12 : cells);

    // A narrow spacer column separates beats
    const templateColumns = ['auto'];
    const cellColumns: string[] = [];
    const beatColumns: string[] = [];
    const cellBeat: number[] = [];
    const cellIndex: number[] = [];
    beatCells.forEach((cells, beat) => {
      if (beat > 0) templateColumns.push('0.5rem');
      const first = templateColumns.length + 1;
      for (let i = 0; i < subColumns(cells); i++) templateColumns.push('1fr');
      const span = subColumns(cells) / cells;
      beatColumns.push(`${first} / span ${subColumns(cells)}`);
      for (let index = 0; index < cells; index++) {
        cellColumns.push(span === 1 ? String(first + index) : `${first + index * span} / span ${span}`);
        cellBeat.push(beat);
        cellIndex.push(index);
      }
    });
    gridContainer.style.gridTemplateColumns = templateColumns.join(' ');

    const beatSubLabel = document.createElement('div');
    beatSubLabel.className = 'step-count-label';
    beatSubLabel.innerText = 'BEAT/SUB';
    beatSubLabel.style.gridRow = '1';
    beatSubLabel.style.gridColumn = '1';
    gridContainer.appendChild(beatSubLabel);

    // Count row: 1 e & a 2 e & a ...; a tuplet beat shows its number and a 3 or 6 above it
    cellColumns.forEach((column, cell) => {
      const beat = cellBeat[cell];
      const isBeatStart = cellIndex[cell] === 0;
      const isTuplet = beatCells[beat] !== straight[beat];
      const count = document.createElement('div');
      count.className = isBeatStart ? 'step-count beat-start' : 'step-count';
      count.innerText = isBeatStart
        ? String(beat + 1)
        : isTuplet ? '' : SUBDIVISION_LABELS[beatCells[beat]]?.[cellIndex[cell]] ?? '';
      count.style.gridRow = '1';
      count.style.gridColumn = column;
      gridContainer.appendChild(count);
    });
    beatCells.forEach((cells, beat) => {
      if (cells === straight[beat]) return;
      const label = document.createElement('div');
      label.className = 'tuplet-label';
      label.innerText = String(cells);
      label.style.gridRow = '1';
      label.style.gridColumn = beatColumns[beat];
      gridContainer.appendChild(label);
    });

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

      const allSteps = gridData[trackId] ??= new Array(patternCells(session.preset)).fill(0);
      const offset = barOffset(session.preset, session.viewBar);
      const trackSteps = allSteps.slice(offset, offset + cellColumns.length);

      for (let step = 0; step < cellColumns.length; step++) {
        const cell = document.createElement('div');
        cell.className = silenced ? 'step-cell silenced' : 'step-cell';
        cell.setAttribute('data-track', String(trackId));
        cell.style.gridRow = row;
        cell.style.gridColumn = cellColumns[step];

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
        if (isSustainedStep(trackSteps, step, beatCells)) cell.classList.add('sustain');

        cell.onclick = () => session.editStep(trackId, step);

        gridContainer.appendChild(cell);
      }
    }

    updatePatternBar();
    updateGridEdges();
  }

  // Marks each edge of the grid with more steps beyond it, so the CSS fades that edge
  function updateGridEdges() {
    const { scrollLeft, clientWidth, scrollWidth } = gridScroller;
    gridScroller.toggleAttribute('data-more-left', scrollLeft > 0.5);
    gridScroller.toggleAttribute('data-more-right', scrollLeft + clientWidth < scrollWidth - 0.5);
  }

  function applyTrackMix() {
    for (const { id: trackId } of TRACKS) {
      byId(`mute-${trackId}`).setAttribute('aria-pressed', String(session.mix.muted.has(trackId)));
      byId(`solo-${trackId}`).setAttribute('aria-pressed', String(session.mix.soloed.has(trackId)));
    }
    drawGrid();
  }

  function updatePatternBar() {
    patternName.textContent = `PAT: ${session.preset.name}`;
    patternSteps.textContent = formatSteps(patternCells(session.preset));
  }

  function resetPosition() {
    patternPosValue.textContent = formatBarStep(1, 1);
  }

  function updatePanelHeader() {
    const { name, bpm } = session.preset;
    panelHeaderText.textContent = `${name}  ·  ${timeSignatureOf(session.preset)}  ·  ${bpm} BPM`;
  }

  function renderPlayback() {
    drawGrid();
    if (!session.isPlaying) {
      resetPosition();
      sequencerDot.classList.remove('lit');
    } else {
      sequencerDot.classList.add('lit');
    }
  }

  function renderTick() {
    patternPosValue.textContent = formatBarStep(session.position.bar, session.position.step + 1);
  }

  // The Session loaded a preset: the controls follow it
  function renderPreset() {
    const preset = session.preset;
    const ts = preset.trainerSettings;

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

    drawGrid();
    grooveSelector.value = "";

    updatePanelHeader();
  }

  // The pattern was saved as a user preset
  function renderSaved() {
    drawGrid(); // Cell handlers must hold the saved copy's steps
    updatePanelHeader();
  }

  session.subscribe(change => {
    if (change === 'grid') drawGrid();
    else if (change === 'mix') applyTrackMix();
    else if (change === 'playback') renderPlayback();
    else if (change === 'tick') renderTick();
    else if (change === 'timer') editorTimer.innerText = formatTimer(session.practiceSeconds);
    else if (change === 'preset') renderPreset();
    else if (change === 'tempo') updatePanelHeader();
    else if (change === 'library') renderSaved();
  });

  barButtons.forEach((button, bar) => {
    button.onclick = () => session.showBar(bar);
  });

  gridScroller.addEventListener('scroll', updateGridEdges, { passive: true });
  window.addEventListener('resize', updateGridEdges);
  // A grid drawn while the Editor was hidden measures nothing: its edges are read again once it is shown
  new ResizeObserver(updateGridEdges).observe(gridScroller);

  function updateTimeSignature() {
    const num = clampNumerator(parseInt(timeSigNum.value, 10));
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
    const next = clampNumerator(numerator + delta);
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

  byId<HTMLButtonElement>('time-sig-num-up').onclick = () => stepNumerator(1);
  byId<HTMLButtonElement>('time-sig-num-down').onclick = () => stepNumerator(-1);
  byId<HTMLButtonElement>('time-sig-den-up').onclick = () => stepDenominator(1);
  byId<HTMLButtonElement>('time-sig-den-down').onclick = () => stepDenominator(-1);

  // React to trainer config updates dynamically
  const formInputs = [trainerEnable, trainerStart, trainerTarget, trainerInc, trainerType, trainerVal, trainerCurve];
  formInputs.forEach(el => {
    el.oninput = () => session.setTrainerFields(readTrainerFields());
    el.onchange = () => {
      session.setTrainerFields(readTrainerFields());
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

  function populateGroovesDropdown() {
    grooveSelector.innerHTML = '<option value="">-- Choose a Groove --</option>';

    const factoryGroup = document.createElement('optgroup');
    factoryGroup.label = "Factory Grooves";
    session.factoryGrooves.forEach(g => factoryGroup.appendChild(option(`factory:${g.id}`, g.name)));
    grooveSelector.appendChild(factoryGroup);

    session.userGrooves().then(userGrooves => {
      if (userGrooves.length > 0) {
        const userGroup = document.createElement('optgroup');
        userGroup.label = "User Grooves";
        userGrooves.forEach(g => userGroup.appendChild(option(`user:${g.id}`, g.name)));
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

  populateGroovesDropdown();
  drawMixCards();
  drawFigurePalette();
  drawGrid();
}
