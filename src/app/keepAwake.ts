import type { PageVisibility, ScreenLock } from './ports';
import type { Session } from './session';

type Held = Awaited<ReturnType<ScreenLock['request']>>;

// The screen stays on while MetroRig sounds: the metronome plays or a chord pad rings. With no lock, or a refused one, nothing changes
export function keepAwake(session: Session, lock: ScreenLock | null, page: PageVisibility): void {
  if (!lock) return;
  let held: Held | null = null;
  let pending = false;

  const sounding = () => session.isPlaying || session.improv.soundingChord !== null;

  function request() {
    if (pending || !page.visible()) return;
    pending = true;
    lock!.request().then(granted => {
      pending = false;
      held = granted;
      if (!sounding()) release(); // The sound stopped while the request was out
    }, () => {
      pending = false; // Refused: the music plays on with the screen's own timeout
    });
  }

  function release() {
    const granted = held;
    held = null;
    granted?.release().catch(() => {});
  }

  session.subscribe(change => {
    if (change !== 'playback' && change !== 'improv') return;
    if (sounding() && !held) request();
    else if (!sounding() && held) release();
  });

  // A hidden page loses its lock, so the one held is gone once it is back
  page.onVisible(() => {
    held = null;
    if (sounding()) request();
  });
}
