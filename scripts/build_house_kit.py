"""Builds the 54 House Kit samples from the kit's Blend recordings.

Usage: python3 -I scripts/build_house_kit.py <kit WAV folder> <output folder>
Writes <output folder>/<piece>/<recording>-<take>.wav. Needs ffmpeg. Applies no gain.
"""
import array
import pathlib
import subprocess
import sys
import wave

SAMPLE_RATE = 44100
TAIL_LEVEL = 32768 * 10 ** (-60 / 20)  # -60 dBFS in 16-bit steps
FADE_FRAMES = round(SAMPLE_RATE * 0.005)
TAKES = (1, 2, 3)

PIECES = {
    'kick': ('Kick/Blend', ('Soft', 'Med', 'Hard')),
    'snare': ('Snare/Blend', ('Soft', 'Hard', 'Crack')),
    'tom-10': ('Toms/10/Blend', ('Soft', 'Med', 'Hard')),
    'tom-12': ('Toms/12/Blend', ('Soft', 'Med', 'Hard')),
    'tom-14': ('Toms/14/Blend', ('Soft', 'Med', 'Hard')),
    'tom-16': ('Toms/16/Blend', ('Soft', 'Med', 'Hard')),
}


def decode(path):
    """The file as interleaved 44.1 kHz, 16-bit, stereo samples."""
    raw = subprocess.run(
        ['ffmpeg', '-nostdin', '-v', 'error', '-i', str(path),
         '-ar', str(SAMPLE_RATE), '-ac', '2', '-f', 's16le', '-c:a', 'pcm_s16le', '-'],
        check=True, stdout=subprocess.PIPE,
    ).stdout
    samples = array.array('h')
    samples.frombytes(raw)
    return samples


def cut_tail(samples):
    """Drops everything after the last frame at or above -60 dBFS."""
    for last in range(len(samples) // 2 - 1, -1, -1):
        if max(abs(samples[2 * last]), abs(samples[2 * last + 1])) >= TAIL_LEVEL:
            return samples[:2 * (last + 1)]
    raise ValueError('the recording never reaches -60 dBFS')


def fade_tail(samples):
    """Ramps the final 5 ms down to a last frame of 0."""
    frames = len(samples) // 2
    start = frames - FADE_FRAMES
    for frame in range(start, frames):
        gain = (frames - 1 - frame) / (FADE_FRAMES - 1)
        samples[2 * frame] = round(samples[2 * frame] * gain)
        samples[2 * frame + 1] = round(samples[2 * frame + 1] * gain)


def write_wav(path, samples):
    with wave.open(str(path), 'wb') as out:
        out.setnchannels(2)
        out.setsampwidth(2)
        out.setframerate(SAMPLE_RATE)
        out.writeframes(samples.tobytes())


def main():
    if len(sys.argv) != 3:
        sys.exit('Usage: build_house_kit.py <kit WAV folder> <output folder>')
    kit, output = map(pathlib.Path, sys.argv[1:])
    for piece, (folder, recordings) in PIECES.items():
        (output / piece).mkdir(parents=True, exist_ok=True)
        for recording in recordings:
            for take in TAKES:
                samples = cut_tail(decode(kit / folder / f'{recording} {take}.wav'))
                fade_tail(samples)
                write_wav(output / piece / f'{recording.lower()}-{take}.wav', samples)


if __name__ == '__main__':
    main()
