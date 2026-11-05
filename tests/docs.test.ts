// @vitest-environment node
import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '..');
const read = (file: string) => fs.readFileSync(path.join(ROOT, file), 'utf8');

const APP_LAYERS = ['domain', 'data', 'storage', 'audio', 'app', 'ui'];
const ENGINE_LAYERS = ['dsp', 'sequencer', 'instruments', 'engine', 'ffi'];

// Every repository path a document names, such as `src/app/session.ts` or engine/src/dsp/
function namedPaths(text: string): string[] {
  const paths = [...text.matchAll(/(?:^|[^\w./-])((?:src|engine|tests|scripts|public)\/[\w./-]*)/g)]
    .map(match => match[1].replace(/\.+$/, ''));
  return [...new Set(paths)];
}

describe('Docs', () => {
  it('CONTRIBUTING names the layers and only paths that exist', () => {
    const text = read('CONTRIBUTING.md');
    const paths = namedPaths(text);
    expect(paths).toEqual(expect.arrayContaining([
      'src/main.ts', 'src/ui/', 'src/app/', 'src/data/', 'src/storage/', 'src/audio/', 'src/domain/',
      'engine/src/ffi.rs', 'engine/src/engine.rs', 'engine/src/instruments/', 'engine/src/sequencer/', 'engine/src/dsp/',
      'tests/layers.test.ts',
    ]));
    expect(paths.filter(name => !fs.existsSync(path.join(ROOT, name)))).toEqual([]);
    expect(text).toMatch(/dependency rule/i);
    // Each layer appears in the rule's table with what it may use
    for (const layer of [...APP_LAYERS, ...ENGINE_LAYERS]) {
      expect(text).toMatch(new RegExp(`^\\| (App|Engine) \\| ${layer} \\| \`[^\`]+\` \\| .+ \\|$`, 'm'));
    }
  });

  it('GLOSSARY defines Session, Trainer, Instrument and each layer', () => {
    const text = read('GLOSSARY.md');
    const definition = (term: string) => text.match(new RegExp(`^- \\*\\*${term}\\*\\*: (.+)$`, 'm'))?.[1] ?? '';
    const undefinedTerms = ['Session', 'Trainer', 'Instrument', ...APP_LAYERS, ...ENGINE_LAYERS]
      .filter(term => definition(term).split(' ').length < 6);
    expect(undefinedTerms).toEqual([]);
    expect(definition('Session')).toContain('src/app/session.ts');
    expect(definition('Trainer')).toContain('engine/src/sequencer/trainer.rs');
    expect(definition('Instrument')).toContain('engine/src/instruments/');
    expect(namedPaths(text).filter(name => !fs.existsSync(path.join(ROOT, name)))).toEqual([]);
  });

  it('STATE records the layer rule as AD-028', () => {
    const text = read('.specs/STATE.md');
    const decisions = text.slice(text.indexOf('## Decisions'));
    const entry = decisions.match(/^### AD-028\n([\s\S]*?)(?=^### |^## |(?![\s\S]))/m)?.[1] ?? '';
    expect(entry).toMatch(/^- \*\*Decision\*\*: .*layer/m);
    for (const layer of [...APP_LAYERS, ...ENGINE_LAYERS]) expect(entry).toContain(`\`${layer}\``);
    expect(entry).toContain('tests/layers.test.ts');
    expect(entry).toMatch(/^- \*\*Status\*\*: active \(AD-028\)$/m);
  });
});
