import fs from 'fs';
import https from 'https';
import path from 'path';

const assets = {
  'mechanical.wav': 'https://raw.githubusercontent.com/rfauver/metronome/master/click.wav',
  'click.wav': 'https://raw.githubusercontent.com/rfauver/metronome/master/click.wav',
  'stick.wav': 'https://raw.githubusercontent.com/wesbos/JavaScript30/master/01%20-%20JavaScript%20Drum%20Kit/sounds/tink.wav',
  'cowbell.wav': 'https://raw.githubusercontent.com/tidalcycles/Dirt-Samples/master/drumtraks/002_DT%20Cowbell.wav',
  'woodblock.wav': 'https://raw.githubusercontent.com/Manza12/MMM/main/data/audio/woodblock.wav'
};

const publicDir = path.resolve('public');
if (!fs.existsSync(publicDir)) {
  fs.mkdirSync(publicDir, { recursive: true });
}

function download(filename, url) {
  return new Promise((resolve, reject) => {
    const destPath = path.join(publicDir, filename);
    const file = fs.createWriteStream(destPath);
    let isRejected = false;

    const handleError = (err) => {
      if (isRejected) return;
      isRejected = true;
      file.destroy();
      fs.unlink(destPath, () => {});
      reject(err);
    };

    file.on('error', handleError);

    const request = https.get(url, (response) => {
      if (response.statusCode !== 200) {
        file.destroy();
        response.resume();
        fs.unlink(destPath, () => {});
        if (!isRejected) {
          isRejected = true;
          reject(new Error(`Failed to download ${filename}: Status code ${response.statusCode}`));
        }
        return;
      }

      response.on('error', (err) => {
        file.destroy();
        fs.unlink(destPath, () => {});
        reject(err);
      });

      response.pipe(file);
      file.on('finish', () => {
        file.close();
        console.log(`Downloaded: ${filename}`);
        resolve();
      });
    });

    request.on('error', handleError);
  });
}

async function main() {
  console.log("Downloading audio assets...");
  for (const [filename, url] of Object.entries(assets)) {
    try {
      await download(filename, url);
    } catch (err) {
      console.error(`Error downloading ${filename}:`, err.message);
      process.exit(1);
    }
  }
  console.log("All audio assets downloaded successfully!");
}

main();
