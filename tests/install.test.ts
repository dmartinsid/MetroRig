// @vitest-environment node
import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { build } from 'vite';
import { Window } from 'happy-dom';

const ROOT = path.resolve(__dirname, '..');
const PUBLIC = path.join(ROOT, 'public');

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

// A PNG's pixel size, read from its IHDR chunk; null when the file is not a PNG
function pngSize(file: string): { width: number; height: number } | null {
  const bytes = fs.readFileSync(file);
  if (!bytes.subarray(0, 8).equals(PNG_SIGNATURE) || bytes.toString('ascii', 12, 16) !== 'IHDR') return null;
  return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
}

type Manifest = {
  name: string; short_name: string; display: string; start_url: string; scope: string;
  theme_color: string; background_color: string;
  icons: { src: string; sizes: string; type: string; purpose?: string }[];
};

// A page's head as a document, to ask its links and metas
function headOf(html: string) {
  const document = new Window().document;
  document.write(html);
  const link = (rel: string) => [...document.querySelectorAll(`link[rel="${rel}"]`)];
  const meta = (name: string) => document.querySelector(`meta[name="${name}"]`)?.getAttribute('content') ?? null;
  return { document, link, meta };
}

// Where a URL the page or the manifest names lands in a build served from /MetroRig/, or null when it leaves the base
function builtFile(outDir: string, url: string, from: string): string | null {
  const { pathname } = new URL(url, `https://example.test${from}`);
  if (!pathname.startsWith('/MetroRig/')) return null;
  return path.join(outDir, decodeURIComponent(pathname.slice('/MetroRig/'.length)));
}

describe('Mobile App', () => {
  it('app icons are PNGs of their sizes', () => {
    const icons: [string, number][] = [
      ['icons/icon-192.png', 192],
      ['icons/icon-512.png', 512],
      ['icons/icon-maskable-512.png', 512],
      ['icons/apple-touch-icon.png', 180],
    ];
    for (const [icon, size] of icons) {
      const file = path.join(PUBLIC, icon);
      expect([icon, fs.existsSync(file)]).toEqual([icon, true]);
      expect([icon, pngSize(file)]).toEqual([icon, { width: size, height: size }]);
    }
  });

  it('mob_28 manifest declares the installable app', () => {
    const file = path.join(PUBLIC, 'manifest.webmanifest');
    const manifest: Manifest = JSON.parse(fs.readFileSync(file, 'utf8'));
    expect(manifest.name).toBe('MetroRig');
    expect(manifest.short_name).toBe('MetroRig');
    expect(manifest.display).toBe('standalone');
    expect(manifest.start_url).toBe('./');
    expect(manifest.scope).toBe('./');
    expect(manifest.theme_color.toLowerCase()).toBe('#080810');
    expect(manifest.background_color.toLowerCase()).toBe('#080810');
    // Each icon a PNG whose file has the size it declares
    const icons = manifest.icons.map(icon => {
      const size = pngSize(path.join(PUBLIC, icon.src));
      return { sizes: icon.sizes, type: icon.type, purpose: icon.purpose ?? 'any', file: size && `${size.width}x${size.height}` };
    });
    for (const icon of icons) expect([icon.type, icon.file]).toEqual(['image/png', icon.sizes]);
    expect(icons.some(icon => icon.sizes === '192x192' && icon.purpose.split(' ').includes('any'))).toBe(true);
    expect(icons.some(icon => icon.sizes === '512x512' && icon.purpose.split(' ').includes('any'))).toBe(true);
    expect(icons.some(icon => icon.sizes === '512x512' && icon.purpose.split(' ').includes('maskable'))).toBe(true);
  });

  it('mob_29 page declares install metadata', () => {
    const { link, meta } = headOf(fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8'));
    // Linked relative to the page, so the build's base reaches them
    expect(link('manifest').map(element => element.getAttribute('href'))).toEqual(['manifest.webmanifest']);
    expect(meta('theme-color')?.toLowerCase()).toBe('#080810');
    const apple = link('apple-touch-icon');
    expect(apple).toHaveLength(1);
    const appleHref = apple[0].getAttribute('href')!;
    expect(appleHref.startsWith('/')).toBe(false);
    expect(pngSize(path.join(PUBLIC, appleHref))).toEqual({ width: 180, height: 180 });
    expect(meta('apple-mobile-web-app-capable')).toBe('yes');
    expect(meta('apple-mobile-web-app-status-bar-style')).toBe('black-translucent');
    const viewport = meta('viewport')!.split(',').map(part => part.trim());
    expect(viewport).toContain('viewport-fit=cover');
    expect(viewport).toContain('width=device-width');
  });

  it('mob_30 built icons resolve under the base', async () => {
    const outDir = fs.mkdtempSync(path.join(os.tmpdir(), 'metrorig-build-'));
    try {
      await build({ root: ROOT, configFile: path.join(ROOT, 'vite.config.ts'), mode: 'production', logLevel: 'silent', build: { outDir, emptyOutDir: true } });
      const { link } = headOf(fs.readFileSync(path.join(outDir, 'index.html'), 'utf8'));
      const page = '/MetroRig/index.html';

      // Every icon and manifest the built page links is a file of the build
      const linked = ['manifest', 'icon', 'apple-touch-icon'].flatMap(rel => link(rel).map(element => [rel, element.getAttribute('href')!]));
      expect(linked.map(([rel]) => rel).sort()).toEqual(['apple-touch-icon', 'icon', 'manifest']);
      for (const [rel, href] of linked) {
        const file = builtFile(outDir, href, page);
        expect([rel, href, file !== null && fs.existsSync(file)]).toEqual([rel, href, true]);
      }

      // Every icon the built manifest names, resolved from where the manifest is served, is a PNG of its size
      const manifestHref = link('manifest')[0].getAttribute('href')!;
      const manifestUrl = new URL(manifestHref, `https://example.test${page}`).pathname;
      const manifest: Manifest = JSON.parse(fs.readFileSync(builtFile(outDir, manifestHref, page)!, 'utf8'));
      expect(manifest.icons.length).toBe(3);
      for (const icon of manifest.icons) {
        const file = builtFile(outDir, icon.src, manifestUrl);
        expect([icon.src, file !== null && fs.existsSync(file)]).toEqual([icon.src, true]);
        const size = pngSize(file!);
        expect([icon.src, `${size?.width}x${size?.height}`]).toEqual([icon.src, icon.sizes]);
      }
      // The app opens at, and stays within, the base
      expect(new URL(manifest.start_url, `https://example.test${manifestUrl}`).pathname).toBe('/MetroRig/');
      expect(new URL(manifest.scope, `https://example.test${manifestUrl}`).pathname).toBe('/MetroRig/');
    } finally {
      fs.rmSync(outDir, { recursive: true, force: true });
    }
  }, 120_000);
});
