// @vitest-environment node
import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '..');
const PUBLIC = path.join(ROOT, 'public');

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

// A PNG's pixel size, read from its IHDR chunk; null when the file is not a PNG
function pngSize(file: string): { width: number; height: number } | null {
  const bytes = fs.readFileSync(file);
  if (!bytes.subarray(0, 8).equals(PNG_SIGNATURE) || bytes.toString('ascii', 12, 16) !== 'IHDR') return null;
  return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
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
});
