import { FACTORY_GROOVES, FACTORY_PRESETS, SPEED_TRAINER_PRESETS } from '../data/factory';
import type { Preset } from '../domain/preset';
import { SONGS, type Song } from '../domain/songs';

// A selector value names where a preset or groove comes from: `factory:<id>`, `song:<id>` or `user:<id>`
export type Source = { kind: 'factory' | 'song' | 'user'; id: string } | null;

export function parseSource(value: string): Source {
  for (const kind of ['factory', 'song', 'user'] as const) {
    if (value.startsWith(`${kind}:`)) return { kind, id: value.replace(`${kind}:`, '') };
  }
  return null;
}

export function factoryPreset(id: string): Preset | undefined {
  return [...FACTORY_PRESETS, ...SPEED_TRAINER_PRESETS].find(p => p.id === id);
}

export function song(id: string): Song | undefined {
  return SONGS.find(s => s.id === id);
}

export function factoryGroove(id: string): { length: number; tracks: Record<number, number[]> } | undefined {
  return FACTORY_GROOVES.find(fg => fg.id === id);
}
