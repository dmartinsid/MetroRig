"""Builds the 54 House Kit samples from the kit's Blend recordings.

Usage: python3 -I scripts/build_house_kit.py <kit WAV folder> <output folder>
Writes <output folder>/<piece>/<recording>-<take>.wav. Needs ffmpeg. Toms get no gain.
Kick and Snare add the LAYERS below, then one gain per piece keeps the loudest take at
full scale, so the dynamics between takes stay as mixed.
"""
import array
import math
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
# Folder, gain, ffmpeg filter, whether to line it up with the Blend take.
LAYERS = {
    'kick': (('Kick/Close', 1.0, 'highpass=f=2000:poles=2', False), ('Kick/Room', 0.5, None, False)),
    'snare': (('Snare/Close', 1.0, None, True), ('Snare/Room', 0.5, None, False)),
}
ONSET_LEVEL = 0.02 * 32768
ALIGN_FRAMES = 3000
ALIGN_REACH = 20


def decode(path, audio_filter=None):
    """The file as interleaved 44.1 kHz, 16-bit, stereo samples."""
    command = ['ffmpeg', '-nostdin', '-v', 'error', '-i', str(path)]
    if audio_filter:
        command += ['-af', audio_filter]
    command += ['-ar', str(SAMPLE_RATE), '-ac', '2', '-f', 's16le', '-c:a', 'pcm_s16le', '-']
    raw = subprocess.run(command, check=True, stdout=subprocess.PIPE).stdout
    samples = array.array('h')
    samples.frombytes(raw)
    return samples


def lag_of(base, layer):
    """The frames by which the layer arrives after the base, by best correlation."""
    onset = next(i for i in range(0, len(base), 2) if abs(base[i]) >= ONSET_LEVEL) // 2
    window = [base[2 * (onset + i)] for i in range(ALIGN_FRAMES)]
    def match(lag):
        return sum(v * layer[2 * max(onset + lag + i, 0)] for i, v in enumerate(window))
    return max(range(-ALIGN_REACH, ALIGN_REACH + 1), key=match)


def mixed(kit, folder, name, layers):
    """The Blend take plus its layers, as floats in 16-bit steps."""
    base = decode(kit / folder / name)
    mix = [float(v) for v in base]
    for layer_folder, gain, audio_filter, align in layers:
        layer = decode(kit / layer_folder / name, audio_filter)
        shift = 2 * lag_of(base, layer) if align else 0
        for i in range(max(0, -shift), min(len(mix), len(layer) - shift)):
            mix[i] += gain * layer[i + shift]
    return mix


def to_samples(mix, gain):
    return array.array('h', (round(v * gain) for v in mix))


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
        layers = LAYERS.get(piece, ())
        mixes = {(recording, take): mixed(kit, folder, f'{recording} {take}.wav', layers)
                 for recording in recordings for take in TAKES}
        peak = max(abs(v) for mix in mixes.values() for v in mix)
        gain = 32767 / peak if layers else 1.0
        for (recording, take), mix in mixes.items():
            samples = cut_tail(to_samples(mix, gain))
            fade_tail(samples)
            write_wav(output / piece / f'{recording.lower()}-{take}.wav', samples)
        if layers:
            print(f'{piece}: peak {peak / 32768:.3f}, gain {20 * math.log10(gain):.1f} dB')


if __name__ == '__main__':
    main()
