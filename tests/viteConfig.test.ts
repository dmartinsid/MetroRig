// @vitest-environment node
import { describe, it, expect } from 'vitest';
import type { ConfigEnv, UserConfig } from 'vite';
import config from '../vite.config';

const resolve = (command: ConfigEnv['command']) =>
  (config as (env: ConfigEnv) => UserConfig)({ command, mode: command === 'build' ? 'production' : 'development' });

describe('vite config', () => {
  it('builds under /MetroRig/ and serves under /', () => {
    expect(resolve('build').base).toBe('/MetroRig/');
    expect(resolve('serve').base).toBe('/');
    // The dev server keeps its port and headers, and the build keeps every asset as a file
    expect(resolve('serve').server?.port).toBe(3000);
    expect(resolve('build').build?.assetsInlineLimit).toBe(0);
  });
});
