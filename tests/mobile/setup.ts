import { createServer, type ViteDevServer } from 'vite';
import type { GlobalSetupContext } from 'vitest/node';
import * as net from 'net';
import * as path from 'path';

declare module 'vitest' {
  export interface ProvidedContext {
    baseUrl: string;
  }
}

// A port no other process holds, so a dev server already running on 3000 does not clash
function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const probe = net.createServer();
    probe.once('error', reject);
    probe.listen(0, '127.0.0.1', () => {
      const { port } = probe.address() as net.AddressInfo;
      probe.close(() => resolve(port));
    });
  });
}

let server: ViteDevServer;

export async function setup({ provide }: GlobalSetupContext) {
  const port = await freePort();
  server = await createServer({
    root: path.resolve(__dirname, '../..'),
    configFile: path.resolve(__dirname, '../../vite.config.ts'),
    server: { port, strictPort: true, host: '127.0.0.1' },
    logLevel: 'error',
  });
  await server.listen();
  provide('baseUrl', `http://127.0.0.1:${port}/`);
}

export async function teardown() {
  await server?.close();
}
