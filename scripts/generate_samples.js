import fs from 'fs';

function writeWavSilence(filename) {
  const buffer = Buffer.alloc(44);
  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36, 4); // File size - 8
  buffer.write('WAVE', 8);
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16); // Subchunk1Size
  buffer.writeUInt16LE(1, 20);  // AudioFormat (PCM)
  buffer.writeUInt16LE(1, 22);  // NumChannels (Mono)
  buffer.writeUInt32LE(44100, 24); // SampleRate
  buffer.writeUInt32LE(88200, 28); // ByteRate
  buffer.writeUInt16LE(2, 32);  // BlockAlign
  buffer.writeUInt16LE(16, 34); // BitsPerSample
  buffer.write('data', 36);
  buffer.writeUInt32LE(0, 40);  // Subchunk2Size
  
  fs.writeFileSync(filename, buffer);
}

if (!fs.existsSync('public')) fs.mkdirSync('public');
writeWavSilence('public/click.wav');
writeWavSilence('public/kick.wav');
writeWavSilence('public/snare.wav');
writeWavSilence('public/hihat.wav');
console.log("Audio sample placeholders generated successfully in public/");
