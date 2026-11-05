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
mountImprov(session);
