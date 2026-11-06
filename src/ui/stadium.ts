import type { Session } from '../app/session';
import { getBeatsPerMeasure, getBeatForStep, isSustainedStep } from '../domain/meter';
import { startBpmFor } from '../domain/preset';
import { STADIUM_GROUPS, groupHit } from '../domain/kit';
import { isAudible } from '../domain/mix';
import { formatTimer, formatTrainerStatus } from './format';
import { byId, option } from './dom';

declare const gsap: any;

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

// The beat clock, the orbs, the Trainer status, the practice timer, the live tempo, the routine selector and the play button
export function mount(session: Session): void {
  const stadiumBpm = byId('stadium-bpm');
  const btnStadiumPlay = byId<HTMLButtonElement>('btn-stadium-play');
  const routineSelector = byId<HTMLSelectElement>('stadium-preset-selector');
  const stadiumTimer = byId('stadium-timer');
  const stadiumStatus = byId('stadium-status');
  const stadiumStatusDot = byId('stadium-status-dot');
  const clockFace = byId<SVGGElement>('clock-face');
  const clockHand = byId<SVGGElement>('clock-hand');
  const orbs = [0, 1, 2, 3].map(i => byId(`orb-${i}`));

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
  function renderPlayback() {
    btnStadiumPlay.classList.toggle('playing', session.isPlaying);
    drawBeatClock();
    if (!session.isPlaying) {
      resetBeatClock();
      stadiumBpm.innerText = session.preset.bpm.toFixed(1);
    }
  }

  // The Trainer fields as the Editor form shows them
  function updateStadiumStatus() {
    const fields = session.trainerFields;
    stadiumStatus.innerText = formatTrainerStatus(fields);
    stadiumStatusDot.classList.toggle('lit', fields.enabled);
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

  // The Session loaded a preset: the clock and the tempo follow it
  function renderPreset() {
    const preset = session.preset;
    // During playback the engine jumps to the preset's start tempo
    const shownBpm = session.isPlaying ? startBpmFor(preset) : preset.bpm;

    drawBeatClock();
    showRoutine();

    stadiumBpm.innerText = shownBpm.toFixed(1);
    updateStadiumStatus();
  }

  // The routines are the speed trainers; any other preset shows the placeholder
  routineSelector.innerHTML = '<option value="">Choose a speed trainer</option>';
  session.trainerPresets.forEach(p => routineSelector.appendChild(option(`factory:${p.id}`, p.name)));

  function showRoutine() {
    routineSelector.value = session.selectedPresetValue;
    if (routineSelector.selectedIndex < 0) routineSelector.value = '';
  }

  routineSelector.onchange = () => {
    if (routineSelector.value) session.loadPreset(routineSelector.value);
  };
  btnStadiumPlay.onclick = () => session.togglePlay();

  session.subscribe(change => {
    if (change === 'library') {
      drawBeatClock();
      showRoutine();
    } else if (change === 'grid' || change === 'mix') drawBeatClock();
    else if (change === 'playback') renderPlayback();
    else if (change === 'tick') renderTick();
    else if (change === 'timer') stadiumTimer.innerText = formatTimer(session.practiceSeconds);
    else if (change === 'preset') renderPreset();
    else if (change === 'view' && session.view === 'stadium') updateStadiumStatus();
    else if (change === 'tempo') stadiumBpm.innerText = session.preset.bpm.toFixed(1);
  });
  if (session.view === 'stadium') updateStadiumStatus();

  showRoutine();
  drawBeatClock();
}
