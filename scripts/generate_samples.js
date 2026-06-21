import fs from 'fs';

function writeWav(filename, type) {
  const sampleRate = 44100;
  let duration = 0.1;
  if (type === 'kick') duration = 0.15;
  if (type === 'snare') duration = 0.15;
  if (type === 'hihat') duration = 0.05;
  if (type === 'click') duration = 0.05;

  const numSamples = Math.floor(sampleRate * duration);
  const dataSize = numSamples * 2; // 16-bit PCM = 2 bytes per sample
  const buffer = Buffer.alloc(44 + dataSize);

  // RIFF header
  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + dataSize, 4); // File size - 8
  buffer.write('WAVE', 8);

  // Format chunk
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16); // Subchunk1Size
  buffer.writeUInt16LE(1, 20);  // AudioFormat (PCM)
  buffer.writeUInt16LE(1, 22);  // NumChannels (Mono)
  buffer.writeUInt32LE(sampleRate, 24); // SampleRate
  buffer.writeUInt32LE(sampleRate * 2, 28); // ByteRate (SampleRate * 1 channel * 2 bytes/sample)
  buffer.writeUInt16LE(2, 32);  // BlockAlign (1 channel * 2 bytes/sample)
  buffer.writeUInt16LE(16, 34); // BitsPerSample

  // Data chunk
  buffer.write('data', 36);
  buffer.writeUInt32LE(dataSize, 40); // Subchunk2Size

  // Generate samples
  for (let i = 0; i < numSamples; i++) {
    const time = i / sampleRate;
    let val = 0;

    if (type === 'click') {
      // 1000 Hz sine wave with fast decay
      val = Math.sin(2 * Math.PI * 1000 * time) * Math.exp(-time * 100);
    } else if (type === 'kick') {
      // Decaying pitch sine wave (kick drum)
      const pitch = 150 * Math.exp(-time * 40) + 40;
      val = Math.sin(2 * Math.PI * pitch * time) * Math.exp(-time * 15);
    } else if (type === 'snare') {
      // White noise with snappy decay + low pitch body
      const noise = (Math.random() * 2 - 1) * Math.exp(-time * 15);
      const body = Math.sin(2 * Math.PI * 180 * time) * Math.exp(-time * 30);
      val = body * 0.4 + noise * 0.6;
    } else if (type === 'hihat') {
      // Short white noise burst
      val = (Math.random() * 2 - 1) * Math.exp(-time * 80);
    }

    // Clamp value to [-1, 1]
    val = Math.max(-1, Math.min(1, val));
    // Convert to 16-bit signed integer
    const sampleVal = Math.floor(val * 32767);
    buffer.writeInt16LE(sampleVal, 44 + i * 2);
  }

  fs.writeFileSync(filename, buffer);
}

if (!fs.existsSync('public')) fs.mkdirSync('public');
writeWav('public/click.wav', 'click');
writeWav('public/kick.wav', 'kick');
writeWav('public/snare.wav', 'snare');
writeWav('public/hihat.wav', 'hihat');
console.log("Audio samples generated successfully in public/");
