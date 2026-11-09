// @vitest-environment node
import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

const WORKFLOW = path.resolve(__dirname, '../.github/workflows/deploy.yml');
const text = fs.existsSync(WORKFLOW) ? fs.readFileSync(WORKFLOW, 'utf8') : '';

// A top-level key's block: its line and every indented line under it
function block(source: string, key: string, indent = ''): string {
  const lines = source.split('\n');
  const start = lines.findIndex(line => line === `${indent}${key}:` || line.startsWith(`${indent}${key}: `));
  if (start < 0) return '';
  const end = lines.findIndex((line, i) => i > start && line.trim() !== '' && !line.startsWith(`${indent} `));
  return lines.slice(start, end < 0 ? undefined : end).join('\n');
}
const job = (name: string) => block(block(text, 'jobs'), name, '  ');
// The commands a job runs, in order
const runs = (jobText: string) => [...jobText.matchAll(/^\s+(?:- )?run: (.+)$/gm)].map(match => match[1].trim());
const uses = (jobText: string) => [...jobText.matchAll(/^\s+(?:- )?uses: ([^@\s]+)@/gm)].map(match => match[1]);

describe('deploy workflow', () => {
  it('deploys on every push to main', () => {
    const on = block(text, 'on');
    const push = block(on, 'push', '  ');
    expect(push).toMatch(/branches: \[main\]/);
    // No filter leaves a push to main undeployed
    expect(push).not.toMatch(/paths|paths-ignore|tags|branches-ignore/);
    expect(uses(job('deploy'))).toEqual(['actions/deploy-pages']);
    expect(job('deploy')).toMatch(/name: github-pages/);
    expect(block(text, 'permissions')).toMatch(/pages: write/);
    expect(block(text, 'permissions')).toMatch(/id-token: write/);
  });

  it('deploys when started by hand', () => {
    expect(block(text, 'on')).toMatch(/^  workflow_dispatch:/m);
    // A run started from any branch tests and builds the head of main; a push builds the commit pushed
    for (const name of ['test', 'build']) {
      const checkout = job(name).split('\n').findIndex(line => /uses: actions\/checkout@/.test(line));
      expect(job(name).split('\n').slice(checkout + 1, checkout + 3).join('\n'))
        .toMatch(/with:\n\s+ref: \$\{\{ github\.event_name == 'workflow_dispatch' && 'refs\/heads\/main' \|\| github\.sha \}\}$/);
    }
  });

  it('compiles the engine before it builds the site', () => {
    const build = job('build');
    const commands = runs(build);
    expect(commands).toContain('rustup target add wasm32-unknown-unknown');
    expect(commands.indexOf('rustup target add wasm32-unknown-unknown')).toBeLessThan(commands.indexOf('npm run build'));
    // npm run build runs build:wasm, which replaces the committed public/pkg/ engine before vite copies it
    expect(JSON.parse(fs.readFileSync(path.resolve(__dirname, '../package.json'), 'utf8')).scripts.build)
      .toMatch(/^npm run build:wasm && vite build$/);
    expect(uses(build)).toEqual(expect.arrayContaining(['actions/upload-pages-artifact']));
    expect(build).toMatch(/path: dist$/m);
  });

  it('deploys only after both test suites pass', () => {
    const tests = runs(job('test'));
    expect(tests).toEqual(expect.arrayContaining(['npm run test:js', 'npm run test:rust']));
    // The pad tests decode the banks with ffmpeg and ffprobe, which the runner image does not ship
    const ffmpeg = tests.findIndex(command => /apt-get install .*\bffmpeg\b/.test(command));
    expect(ffmpeg).toBeGreaterThan(-1);
    expect(ffmpeg).toBeLessThan(tests.indexOf('npm run test:rust'));
    expect(job('build')).toMatch(/^    needs: test$/m);
    expect(job('deploy')).toMatch(/^    needs: build$/m);
    expect(runs(job('deploy'))).toEqual([]);
    // Nothing lets a failed step or job through to the deploy
    expect(text).not.toMatch(/continue-on-error|^\s+if:/m);
  });

  it('queues a newer deploy behind a running one', () => {
    const concurrency = block(text, 'concurrency');
    expect(concurrency).toMatch(/group: pages$/m);
    expect(concurrency).toMatch(/cancel-in-progress: false$/m);
  });
});
