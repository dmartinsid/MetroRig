// @vitest-environment node
import { describe, it, expect } from 'vitest';
import type { ConfigEnv, UserConfig } from 'vite';
import config from '../vite.config';

const resolve = (command: ConfigEnv['command'], isPreview = false) =>
  (config as (env: ConfigEnv) => UserConfig)({ command, mode: command === 'build' || isPreview ? 'production' : 'development', isPreview });

describe('vite config', () => {
  it('builds under /MetroRig/ and serves under /', () => {
    expect(resolve('build').base).toBe('/MetroRig/');
    expect(resolve('serve').base).toBe('/');
    // vite preview serves the build, so it must use the build's base
    expect(resolve('serve', true).base).toBe('/MetroRig/');
    // The dev server keeps its port and headers, and the build keeps every asset as a file
    expect(resolve('serve').server?.port).toBe(3000);
    expect(resolve('build').build?.assetsInlineLimit).toBe(0);
  });
});
