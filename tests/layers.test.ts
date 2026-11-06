// @vitest-environment node
import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '..');
const CRATE = path.join(ROOT, 'engine', 'src');

function filesUnder(folder: string, extension: string): string[] {
  if (!fs.existsSync(folder)) return [];
  return fs.readdirSync(folder, { withFileTypes: true }).flatMap(entry => {
    const full = path.join(folder, entry.name);
    if (entry.isDirectory()) return filesUnder(full, extension);
    return entry.name.endsWith(extension) ? [full] : [];
  });
}

// --- Rust ---

// The engine's layers, each with the layers below it that it may use
const RUST_LAYERS: Record<string, string[]> = {
  dsp: [],
  sequencer: [],
  instruments: ['dsp'],
  engine: ['sequencer', 'instruments', 'dsp'],
  ffi: ['engine'],
};

const rel = (file: string) => path.relative(CRATE, file).split(path.sep).join('/');

function withoutComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
}

// The item that follows a `#[cfg(test)]`, whether a `mod x;` line or a braced block, is test code
function withoutTestCode(source: string): string {
  const lines = source.split('\n');
  const kept: string[] = [];
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].trim() !== '#[cfg(test)]') {
      kept.push(lines[i]);
      continue;
    }
    let j = i + 1;
    while (j < lines.length && lines[j].trim().startsWith('#[')) j++;
    if (!lines[j]?.includes('{')) {
      i = j;
      continue;
    }
    let depth = 0;
    for (; j < lines.length; j++) {
      depth += (lines[j].match(/\{/g) ?? []).length - (lines[j].match(/\}/g) ?? []).length;
      if (depth === 0) break;
    }
    i = j;
  }
  return kept.join('\n');
}

// Files declared only under `#[cfg(test)]`, such as `golden_tests.rs` and `ffi_tests.rs`
function testOnlyFiles(): Set<string> {
  const found = new Set<string>();
  for (const file of filesUnder(CRATE, '.rs')) {
    const source = fs.readFileSync(file, 'utf8');
    const declaration = /#\[cfg\(test\)\]\s*((?:#\[[^\]]*\]\s*)*)mod\s+(\w+)\s*;/g;
    for (const match of source.matchAll(declaration)) {
      const pathAttribute = match[1].match(/#\[path\s*=\s*"([^"]+)"\]/);
      const folder = /(^|\/)(lib|mod)\.rs$/.test(rel(file))
        ? path.dirname(file)
        : path.join(path.dirname(file), path.basename(file, '.rs'));
      found.add(pathAttribute ? path.join(path.dirname(file), pathAttribute[1]) : path.join(folder, `${match[2]}.rs`));
    }
  }
  return found;
}

interface RustFile {
  name: string; // relative to engine/src, with `/`
  production: string; // test code and comments removed
}

function productionRustFiles(): RustFile[] {
  const tests = testOnlyFiles();
  return filesUnder(CRATE, '.rs')
    .filter(file => !tests.has(file))
    .map(file => ({ name: rel(file), production: withoutTestCode(withoutComments(fs.readFileSync(file, 'utf8'))) }));
}

// The module path of a file: `instruments/pad/voice.rs` is instruments::pad::voice, `dsp/mod.rs` is dsp
function modulePath(name: string): string[] {
  const parts = name.replace(/\.rs$/, '').split('/');
  const last = parts[parts.length - 1];
  return last === 'mod' || last === 'lib' ? parts.slice(0, -1) : parts;
}

// Every path of a `use` tree, braces matched at any depth: `dsp::{sample::{trim_onset}, Engine}` is
// dsp::sample::trim_onset and dsp::Engine. `start` is just past `crate::` or `super::`. A path renamed
// with `as` also lands in `aliases`, under its new name
function useTreePaths(source: string, start: number, aliases: Map<string, string> = new Map()): string[] {
  let i = start;
  const skipSpace = () => { while (/\s/.test(source[i] ?? '')) i++; };
  function item(): string[] {
    skipSpace();
    if (source[i] === '{') return group();
    const segment = source.slice(i).match(/^[\w*]+/)?.[0] ?? '';
    i += segment.length;
    skipSpace();
    if (source.startsWith('::', i)) {
      i += 2;
      return item().map(rest => `${segment}::${rest}`);
    }
    const alias = source.slice(i).match(/^as\s+(\w+)/);
    if (alias) {
      i += alias[0].length;
      return [`${segment} as ${alias[1]}`];
    }
    return [segment];
  }
  function group(): string[] {
    i++; // the `{`
    const paths: string[] = [];
    for (;;) {
      skipSpace();
      if (source[i] === '}' || i >= source.length) { i++; break; }
      if (source[i] === ',') { i++; continue; }
      const before = i;
      paths.push(...item());
      if (i === before) i++; // A character no use tree holds
    }
    return paths.filter(Boolean);
  }
  return item().filter(Boolean).map(path => {
    const renamed = path.match(/^(.*) as (\w+)$/);
    if (!renamed) return path;
    aliases.set(renamed[2], renamed[1]);
    return renamed[1];
  });
}

// The crate path a path names from `base`: `super` climbs one module and `self` stays
function resolve(base: string[], path: string): string[] {
  const target = [...base];
  for (const segment of path.split('::').filter(Boolean)) {
    if (segment === 'super') target.pop();
    else if (segment !== 'self') target.push(segment);
  }
  return target;
}

// Every crate module a file names: `crate::x`, `crate::{x, y::{z}}`, the crate's own name `metrorig_audio::x`,
// `self::` and `super::` resolved from where the file sits, and any name a `use ... as` gave a module, such as
// `use super::super as root;` read through `root::engine`. A path that reaches only the crate root names no layer
function rustImports(file: RustFile): { layer: string; text: string }[] {
  const found: { layer: string; text: string }[] = [];
  const here = modulePath(file.name);
  const renamed = new Map<string, string[]>(); // alias -> the crate path it stands for
  const add = (target: string[], text: string) => {
    if (target.length > 0) found.push({ layer: target[0], text });
  };
  for (const match of file.production.matchAll(/\b(?:crate|metrorig_audio)::|\bself::|\b(?:super::)+/g)) {
    const start = match.index! + match[0].length;
    const base = match[0] === 'self::' ? here
      : match[0].startsWith('super::') ? here.slice(0, -(match[0].split('super::').length - 1))
      : [];
    const aliases = new Map<string, string>();
    const paths = useTreePaths(file.production, start, aliases);
    for (const path of paths.length > 0 ? paths : ['']) add(resolve(base, path), `${match[0]}${path}`);
    for (const [alias, path] of aliases) renamed.set(alias, resolve(base, path));
  }
  for (const [alias, target] of renamed) {
    for (const match of file.production.matchAll(new RegExp(`(?<![\\w:])${alias}::`, 'g'))) {
      for (const path of useTreePaths(file.production, match.index! + match[0].length)) {
        add([...target, ...resolve([], path)], `${alias}::${path}`);
      }
    }
  }
  // A `#[path]` module may sit in any folder, so production code may not use one
  for (const match of file.production.matchAll(/#\[path\s*=\s*"([^"]*)"\]/g)) {
    found.push({ layer: '#[path]', text: match[0] });
  }
  return found;
}

const layerOf = (name: string) => modulePath(name)[0] ?? 'lib';

// Each import that reaches a layer the file's layer may not use, naming the file and the import
function rustCrossings(files: RustFile[]): string[] {
  return files.flatMap(file => {
    const layer = layerOf(file.name);
    return rustImports(file)
      .filter(use => use.layer !== layer && !(RUST_LAYERS[layer] ?? []).includes(use.layer))
      .map(use => `${file.name} (${layer}) uses ${use.text}`);
  });
}

function structFields(source: string, name: string): { field: string; type: string }[] {
  const body = source.match(new RegExp(`struct\\s+${name}\\s*\\{([\\s\\S]*?)\\n\\}`));
  if (!body) return [];
  return body[1]
    .split('\n')
    .map(line => line.trim().match(/^(?:pub(?:\([^)]*\))?\s+)?(\w+)\s*:\s*([^,]+),?$/))
    .filter((match): match is RegExpMatchArray => match !== null)
    .map(match => ({ field: match[1], type: match[2].trim() }));
}

describe('Layers', () => {
  it('the engine crate lives in engine/ and src/ holds no .rs file', () => {
    const manifest = path.join(ROOT, 'engine', 'Cargo.toml');
    expect(fs.existsSync(manifest)).toBe(true);
    expect(fs.readFileSync(manifest, 'utf8')).toMatch(/^name\s*=\s*"metrorig_audio"$/m);
    expect(fs.existsSync(path.join(CRATE, 'lib.rs'))).toBe(true);
    expect(fs.existsSync(path.join(ROOT, 'Cargo.toml'))).toBe(false);
    expect(filesUnder(path.join(ROOT, 'src'), '.rs').map(file => path.relative(ROOT, file))).toEqual([]);
  });

  it('the engine crate has every layered module', () => {
    const declares = (file: string, modules: string[]) => {
      const source = withoutTestCode(withoutComments(fs.readFileSync(path.join(CRATE, file), 'utf8')));
      const declared = [...source.matchAll(/^\s*(?:pub(?:\([^)]*\))?\s+)?mod\s+(\w+)\s*;/gm)].map(match => match[1]);
      return modules.filter(module => !declared.includes(module)).map(module => `${file}: mod ${module}`);
    };
    const missing = [
      ...declares('lib.rs', ['ffi', 'engine', 'sequencer', 'instruments', 'dsp']),
      ...declares('sequencer/mod.rs', ['clock', 'pattern', 'trainer']),
      ...declares('instruments/mod.rs', ['click', 'drums', 'pad']),
    ];
    const files = ['ffi.rs', 'engine.rs', 'sequencer/clock.rs', 'sequencer/pattern.rs', 'sequencer/trainer.rs',
      'instruments/click.rs', 'instruments/drums.rs', 'instruments/pad/mod.rs', 'dsp/mod.rs'];
    expect(missing).toEqual([]);
    expect(files.filter(file => !fs.existsSync(path.join(CRATE, file)))).toEqual([]);
  });

  it('extern C and unsafe live only in ffi.rs', () => {
    const outside = productionRustFiles()
      .filter(file => file.name !== 'ffi.rs')
      .flatMap(file => [
        ...(/\bunsafe\b/.test(file.production) ? [`${file.name}: unsafe`] : []),
        ...(/extern\s+"C"/.test(file.production) ? [`${file.name}: extern "C"`] : []),
      ]);
    expect(outside).toEqual([]);
    expect(productionRustFiles().find(file => file.name === 'ffi.rs')?.production).toMatch(/extern\s+"C"/);
  });

  it('engine modules depend downward only', () => {
    expect(rustCrossings(productionRustFiles().filter(file => file.name !== 'lib.rs'))).toEqual([]);
    expect(Object.keys(RUST_LAYERS).sort()).toEqual(
      [...new Set(productionRustFiles().filter(file => file.name !== 'lib.rs').map(file => layerOf(file.name)))].sort());
  });

  it('no engine file holds over 400 lines of production code', () => {
    const long = productionRustFiles()
      .map(file => ({ name: file.name, lines: file.production.split('\n').filter(line => line.trim() !== '').length }))
      .filter(file => file.lines > 400)
      .map(file => `${file.name}: ${file.lines} lines`);
    expect(long).toEqual([]);
  });

  it('the Engine holds the Trainer in one field', () => {
    const fields = structFields(fs.readFileSync(path.join(CRATE, 'engine.rs'), 'utf8'), 'Engine');
    expect(fields.length).toBeGreaterThan(0);
    const trainer = fields.filter(entry => entry.type === 'Trainer');
    expect(trainer.map(entry => entry.field)).toEqual(['trainer']);
    const others = fields.filter(entry => entry.type !== 'Trainer'
      && /trainer|accumulated|schedule|pending|target_bpm|start_bpm|increment|step_type|step_value|curve/i
        .test(`${entry.field}: ${entry.type}`));
    expect(others).toEqual([]);
  });

  it('the Trainer holds no tempo and no Engine', () => {
    const source = withoutTestCode(withoutComments(fs.readFileSync(path.join(CRATE, 'sequencer', 'trainer.rs'), 'utf8')));
    const fields = structFields(source, 'Trainer');
    expect(fields.length).toBeGreaterThan(0);
    expect(fields.filter(entry => /bpm|tempo|clock|engine/i.test(`${entry.field}: ${entry.type}`))).toEqual([]);
    expect(source).not.toMatch(/\b(Engine|Clock)\b/);
    // Each rule hands the new tempo back to its caller
    for (const rule of ['on_start', 'on_bar_start', 'on_frame']) {
      expect(source).toMatch(new RegExp(`pub fn ${rule}\\([^)]*\\)\\s*->\\s*Option<f64>`));
    }
  });
});

// --- TypeScript ---

const SRC = path.join(ROOT, 'src');

// The app's layers, each with the layers below it that it may import; main.ts composes them all
const TS_LAYERS: Record<string, string[]> = {
  domain: [],
  data: ['domain'],
  storage: ['domain'],
  audio: ['domain'],
  app: ['domain', 'data', 'storage', 'audio'],
  ui: ['app', 'domain'],
  main: ['domain', 'data', 'storage', 'audio', 'app', 'ui'],
};

interface TsFile {
  name: string; // relative to the repository root, with `/`
  source: string;
}

function sourceFiles(): TsFile[] {
  return filesUnder(SRC, '.ts').map(file => ({
    name: path.relative(ROOT, file).split(path.sep).join('/'),
    source: fs.readFileSync(file, 'utf8'),
  }));
}

// Every module a file names: static imports and re-exports, side-effect imports, dynamic imports and `?url` imports
function tsImports(source: string): string[] {
  const code = withoutComments(source);
  const patterns = [
    /\b(?:import|export)\s+[^'";]*?\bfrom\s*['"]([^'"]+)['"]/g,
    /\bimport\s*['"]([^'"]+)['"]/g,
    /\bimport\(\s*['"]([^'"]+)['"]\s*\)/g,
  ];
  return patterns.flatMap(pattern => [...code.matchAll(pattern)].map(match => match[1]));
}

// The file an import names, relative to the repository root, or null for a package
function resolveImport(from: string, specifier: string): string | null {
  if (!specifier.startsWith('.')) return null;
  const target = path.posix.normalize(path.posix.join(path.posix.dirname(from), specifier.replace(/\?.*$/, '')));
  return target.endsWith('.ts') ? target : `${target}.ts`;
}

// `src/main.ts` is main, `src/app/session.ts` is app, anything outside src/ is outside
function tsLayerOf(name: string): string {
  if (name === 'src/main.ts') return 'main';
  const parts = name.split('/');
  return parts[0] === 'src' && parts.length > 2 ? parts[1] : 'outside';
}

function tsCrossings(files: TsFile[]): string[] {
  return files.flatMap(file => {
    const layer = tsLayerOf(file.name);
    return tsImports(file.source).flatMap(specifier => {
      const target = resolveImport(file.name, specifier);
      if (target === null) return [];
      const targetLayer = tsLayerOf(target);
      const allowed = targetLayer === layer || (TS_LAYERS[layer] ?? []).includes(targetLayer);
      return allowed ? [] : [`${file.name} (${layer}) imports '${specifier}' (${targetLayer})`];
    });
  });
}

// Each cycle as the chain of files that closes it, found by a depth-first walk over the import graph
function tsCycles(files: TsFile[]): string[] {
  const graph = new Map(files.map(file => [file.name, tsImports(file.source)
    .map(specifier => resolveImport(file.name, specifier))
    .filter((target): target is string => target !== null)]));
  const cycles: string[] = [];
  const done = new Set<string>();
  const visit = (file: string, trail: string[]) => {
    if (trail.includes(file)) {
      cycles.push([...trail.slice(trail.indexOf(file)), file].join(' -> '));
      return;
    }
    if (done.has(file)) return;
    for (const target of graph.get(file) ?? []) visit(target, [...trail, file]);
    done.add(file);
  };
  for (const file of graph.keys()) visit(file, []);
  return cycles;
}

describe('Layers', () => {
  it('src holds the six layers and main.ts alone at its root', () => {
    const entries = fs.readdirSync(SRC, { withFileTypes: true });
    expect(entries.filter(entry => entry.isDirectory()).map(entry => entry.name).sort())
      .toEqual(['app', 'audio', 'data', 'domain', 'storage', 'ui']);
    expect(entries.filter(entry => !entry.isDirectory()).map(entry => entry.name)).toEqual(['main.ts']);
  });

  it('src imports downward only', () => {
    const files = sourceFiles();
    expect(files.length).toBeGreaterThan(20);
    expect(tsCrossings(files)).toEqual([]);
    // Every layer holds code, and only main.ts imports ui
    expect([...new Set(files.map(file => tsLayerOf(file.name)))].sort()).toEqual(Object.keys(TS_LAYERS).sort());
    const intoUi = files.filter(file => tsLayerOf(file.name) !== 'ui' && tsImports(file.source)
      .some(specifier => tsLayerOf(resolveImport(file.name, specifier) ?? '') === 'ui'));
    expect(intoUi.map(file => file.name)).toEqual(['src/main.ts']);
  });

  it('src has no import cycle', () => {
    expect(tsCycles(sourceFiles())).toEqual([]);
  });

  it('a crossing import fails naming the file and the import', () => {
    const crossing = [
      { name: 'src/domain/meter.ts', source: "import { Session } from '../app/session';" },
      { name: 'src/app/session.ts', source: "import { mount } from '../ui/editor';" },
      { name: 'src/ui/editor.ts', source: "const node = await import('../audio/MetronomeNode');" },
      { name: 'src/audio/visualSync.ts', source: "import workletUrl from '../storage/database?url';" },
      { name: 'src/ui/header.ts', source: "import { FACTORY_PRESETS } from '../data/factory';" },
    ];
    expect(tsCrossings(crossing)).toEqual([
      "src/domain/meter.ts (domain) imports '../app/session' (app)",
      "src/app/session.ts (app) imports '../ui/editor' (ui)",
      "src/ui/editor.ts (ui) imports '../audio/MetronomeNode' (audio)",
      "src/audio/visualSync.ts (audio) imports '../storage/database?url' (storage)",
      "src/ui/header.ts (ui) imports '../data/factory' (data)",
    ]);
    const cycle = [
      { name: 'src/domain/pattern.ts', source: "import { TRACKS } from './kit';" },
      { name: 'src/domain/kit.ts', source: "export { barSteps } from './pattern';" },
    ];
    expect(tsCycles(cycle)).toEqual(['src/domain/pattern.ts -> src/domain/kit.ts -> src/domain/pattern.ts']);
    const rustCrossing: RustFile[] = [
      { name: 'instruments/click.rs', production: 'use crate::engine::Engine;' },
      { name: 'instruments/drums.rs', production: 'use crate::{dsp::sample, engine::Engine};' },
      { name: 'sequencer/clock.rs', production: 'use crate::{dsp::{sample::trim_onset}, engine::{Engine, Event as E}};' },
      { name: 'instruments/click.rs', production: 'use super::super::engine::Engine;' },
      { name: 'instruments/pad/voice.rs', production: 'use super::super::super::{dsp::gain, ffi::{tick}};' },
      { name: 'dsp/filter.rs', production: 'use metrorig_audio::{dsp::chorus, sequencer::clock::Clock};' },
      { name: 'lib.rs', production: 'use self::engine::Engine;' },
      { name: 'instruments/click.rs', production: 'use super::super as root;\nfn f() { root::engine::Engine::new(1.0); }' },
      { name: 'sequencer/clock.rs', production: 'use crate::{self as top};\nfn f() { let _ = top::{dsp::chorus}; }' },
      { name: 'dsp/reverb.rs', production: '#[path = "../engine.rs"]\nmod engine;' },
      // Allowed: downward, grouped and nested, and super:: staying in the layer
      { name: 'engine/mod.rs', production: 'use crate::{sequencer::{clock::Clock, trainer::Trainer}, instruments::drums::Drums};' },
      { name: 'instruments/pad/voice.rs', production: 'use super::super::click::Click;' },
      { name: 'dsp/mod.rs', production: 'use self::{sample::Sample, reverb::Reverb};' },
      { name: 'instruments/pad/mod.rs', production: 'use self::voice::Voice;' },
      { name: 'ffi.rs', production: 'use metrorig_audio::engine::Engine;' },
      { name: 'instruments/drums.rs', production: 'use crate::dsp as d;\nfn f() { d::sample::trim_onset(); }' },
    ];
    expect(rustCrossings(rustCrossing)).toEqual([
      'instruments/click.rs (instruments) uses crate::engine::Engine',
      'instruments/drums.rs (instruments) uses crate::engine::Engine',
      'sequencer/clock.rs (sequencer) uses crate::dsp::sample::trim_onset',
      'sequencer/clock.rs (sequencer) uses crate::engine::Engine',
      'sequencer/clock.rs (sequencer) uses crate::engine::Event',
      'instruments/click.rs (instruments) uses super::super::engine::Engine',
      'instruments/pad/voice.rs (instruments) uses super::super::super::ffi::tick',
      'dsp/filter.rs (dsp) uses metrorig_audio::sequencer::clock::Clock',
      'lib.rs (lib) uses self::engine::Engine',
      'instruments/click.rs (instruments) uses root::engine::Engine::new',
      'sequencer/clock.rs (sequencer) uses top::dsp::chorus',
      'dsp/reverb.rs (dsp) uses #[path = "../engine.rs"]',
    ]);
  });

  it('ui holds one module per screen and the header', () => {
    const missing = ['header', 'editor', 'stadium', 'grooves', 'improv'].filter(screen => {
      const file = path.join(SRC, 'ui', `${screen}.ts`);
      return !fs.existsSync(file) || !/export function mount\(session: Session\)/.test(fs.readFileSync(file, 'utf8'));
    });
    expect(missing).toEqual([]);
  });

  it('main.ts holds at most 150 lines', () => {
    const lines = fs.readFileSync(path.join(SRC, 'main.ts'), 'utf8').trimEnd().split('\n').length;
    expect(lines).toBeGreaterThan(0);
    expect(lines).toBeLessThanOrEqual(150);
  });
});
