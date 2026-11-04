import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const source = path.resolve(__dirname, '../engine/target/wasm32-unknown-unknown/release/metrorig_audio.wasm');
const destDir = path.resolve(__dirname, '../public/pkg');
const dest = path.resolve(destDir, 'metrorig_audio_bg.wasm');

console.log(`Copying WASM from: ${source}`);
console.log(`To destination: ${dest}`);

if (!fs.existsSync(source)) {
  console.error(`Error: Compiled WASM file not found at: ${source}`);
  console.error('Please run "cargo build --manifest-path engine/Cargo.toml --target wasm32-unknown-unknown --release" first.');
  process.exit(1);
}

try {
  if (!fs.existsSync(destDir)) {
    fs.mkdirSync(destDir, { recursive: true });
  }
  fs.copyFileSync(source, dest);
  console.log('WASM file successfully copied to public/pkg/metrorig_audio_bg.wasm');
} catch (err) {
  console.error(`Error copying WASM file: ${err.message}`);
  process.exit(1);
}
