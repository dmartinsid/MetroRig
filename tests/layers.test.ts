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

// Every crate module a file names: `crate::x`, `crate::{x, y}` and `super::` resolved from where the file sits
function rustImports(file: RustFile): { layer: string; text: string }[] {
  const found: { layer: string; text: string }[] = [];
  for (const match of file.production.matchAll(/crate::\{([^}]*)\}/g)) {
    for (const item of match[1].split(',').map(part => part.trim()).filter(Boolean)) {
      found.push({ layer: item.split('::')[0], text: `crate::{${item}}` });
    }
  }
  for (const match of file.production.matchAll(/crate::(\w+)/g)) {
    found.push({ layer: match[1], text: match[0] });
  }
  for (const match of file.production.matchAll(/\b((?:super::)+)(\w+)?/g)) {
    const levels = match[1].split('super::').length - 1;
    const target = [...modulePath(file.name).slice(0, -levels), match[2] ?? ''].filter(Boolean);
    found.push({ layer: target[0] ?? '', text: match[0] });
  }
  return found;
}

const layerOf = (name: string) => modulePath(name)[0] ?? 'lib';

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
    const crossings = productionRustFiles()
      .filter(file => file.name !== 'lib.rs')
      .flatMap(file => {
        const layer = layerOf(file.name);
        return rustImports(file)
          .filter(use => use.layer !== layer && !RUST_LAYERS[layer].includes(use.layer))
          .map(use => `${file.name} (${layer}) uses ${use.text}`);
      });
    expect(crossings).toEqual([]);
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
