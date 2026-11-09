// The composition root: builds the audio node, the storage and the Session, then mounts the header and the screens on it
import { MetronomeNode } from './audio/MetronomeNode';
import { StateManager } from './app/stateManager';
import { Session } from './app/session';
import { browserPreferences } from './storage/preferences';
import { mount as mountHeader } from './ui/header';
import { mount as mountEditor } from './ui/editor';
import { mount as mountStadium } from './ui/stadium';
import { mount as mountGrooves } from './ui/grooves';
import { mount as mountImprov } from './ui/improv';
import workletUrl from './audio/metronome-processor?url';
import { ENGINE_WASM } from './domain/assets';

const audioNode = new MetronomeNode();
const session = new Session({
  engine: audioNode,
  state: new StateManager(),
  prefs: browserPreferences,
  dialogs: { confirm: message => confirm(message) },
  wasmUrl: ENGINE_WASM,
  workletUrl,
  assetBase: import.meta.env.BASE_URL, // `/` on the dev server, `/MetroRig/` in the build
});

mountHeader(session);
mountEditor(session);
mountStadium(session);
mountGrooves(session);
mountImprov(session);
