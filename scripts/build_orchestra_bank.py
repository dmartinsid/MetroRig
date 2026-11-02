"""Builds the 14 Orchestra pad files from the string recordings of VSCO 2 Community Edition.

Usage: python3 -I scripts/build_orchestra_bank.py <VSCO folder> <output folder>
Writes <output folder>/<note>.flac, named as the other pad banks: 44.1 kHz, 16-bit, stereo, frames 0 to 176400, where frame 176400
repeats frame 0, so the loop lasts 4 s and closes exactly. Needs ffmpeg. The same input gives the same bytes.

Each recording is pitched to its key, tuned to its measured pitch centre, and cut to the 5 s where its
level moves least. Its last second crossfades into its first, the recordings of a key are mixed, and
a slow gain takes out what level movement is left, so the loop does not pulse.
"""
import array
import cmath
import math
import pathlib
import subprocess
import sys

SAMPLE_RATE = 44100
STRETCH_FRAMES = 5 * SAMPLE_RATE
CROSSFADE_FRAMES = SAMPLE_RATE
LOOP_FRAMES = STRETCH_FRAMES - CROSSFADE_FRAMES
BLOCK_FRAMES = 441  # 10 ms, the grid of every level measurement
WINDOW_BLOCKS = 10  # 100 ms
STRETCH_BLOCKS = STRETCH_FRAMES // BLOCK_FRAMES
ATTACK_BLOCKS = 60  # 600 ms
LOUDEST_STRETCH_DB = 6  # A flat stretch this far under the loudest one is the release
FLATTEN_PASSES = 4
FULL_SCALE_RMS = 10 ** (-22 / 20)  # A note at level 0 dB
HEADROOM_PEAK = 0.97
PITCH_RATE = SAMPLE_RATE // 4
VIBRATO_REACH = 0.022  # Of a harmonic's frequency, about 38 cents
VIBRATO_HZ = 8
TUNED_CENTS = 0.5
TUNING_PASSES = 4

# VSCO counts octaves so that C3 is MIDI 60, so `C1` is MIDI 36, not 24. The notes below are the ones
# measured in each recording. Section recordings have a soft layer, `v1`, the one the demo used.
# SPEC_DEVIATION: keys 23, 27 and 31 hold the contrabass alone, where the design mixes cello up to key 43
# Reason: the cello's lowest recording is MIDI 36. The approved demo also left the lowest note to the contrabass
CELLO = 'Strings/Cello Section/susvib/susvib_{}_v1_1.wav'
VIOLA = 'Strings/Viola Section/susvib/ViolaEns_susvib_{}_v1_1.wav'
VIOLIN = 'Strings/Violin Section/susVib/VlnEns_susVib_{}_v1.wav'
CONTRABASS = 'Strings/Solo Contrabass/SusVib/BKCtbss_SusVib_{}_v1_rr1.wav'

NOTE_NAMES = ('C', 'Cs', 'D', 'Ds', 'E', 'F', 'Fs', 'G', 'Gs', 'A', 'As', 'B')

# Levels in dB, the balance the approved demo measures: cello and violin even, violas 7 dB under, and a
# low cello 5 dB over them, with the contrabass 10 dB under that cello and 4 dB under on the lowest notes
LOW_CELLO = 5
LOW_CONTRABASS = -5
LOWEST_CONTRABASS = -4
VIOLA_LEVEL = -7
# key: (recording, name, measured MIDI note, level in dB), ...
BANK = {
    23: ((CONTRABASS, 'F#0', 30, LOWEST_CONTRABASS),),
    27: ((CONTRABASS, 'F#0', 30, LOWEST_CONTRABASS),),
    31: ((CONTRABASS, 'G0', 31, LOWEST_CONTRABASS),),
    35: ((CELLO, 'C1', 36, LOW_CELLO), (CONTRABASS, 'C1', 36, LOW_CONTRABASS)),
    39: ((CELLO, 'E1', 40, LOW_CELLO), (CONTRABASS, 'E1', 40, LOW_CONTRABASS)),
    43: ((CELLO, 'G1', 43, LOW_CELLO), (CONTRABASS, 'G#1', 44, LOW_CONTRABASS)),
    47: ((CELLO, 'B1', 47, 0),),
    51: ((VIOLA, 'E2', 52, VIOLA_LEVEL),),
    55: ((VIOLA, 'B2', 59, VIOLA_LEVEL),),
    59: ((VIOLIN, 'B2', 59, 0),),
    63: ((VIOLIN, 'D3', 62, 0),),
    67: ((VIOLIN, 'F#3', 66, 0),),
    71: ((VIOLIN, 'C4', 72, 0),),
    75: ((VIOLIN, 'E4', 76, 0),),
}


def decode(path, ratio):
    """Left and right, as floats, with every pitch moved by the ratio."""
    speed = round(SAMPLE_RATE * ratio)
    command = ['ffmpeg', '-nostdin', '-v', 'error', '-i', str(path),
               '-af', f'asetrate={speed},aresample={SAMPLE_RATE}',
               '-ac', '2', '-c:a', 'pcm_f32le', '-f', 'f32le', '-']
    samples = array.array('f')
    samples.frombytes(subprocess.run(command, check=True, stdout=subprocess.PIPE).stdout)
    return samples[0::2], samples[1::2]


def block_energies(left, right):
    return [sum(v * v for v in left[i:i + BLOCK_FRAMES]) + sum(v * v for v in right[i:i + BLOCK_FRAMES])
            for i in range(0, len(left) - BLOCK_FRAMES + 1, BLOCK_FRAMES)]


def steadiest_start(left, right):
    """The first frame of the 5 s past the attack where the level moves least."""
    energies = block_energies(left, right)
    windows = [sum(energies[i:i + WINDOW_BLOCKS]) for i in range(len(energies) - WINDOW_BLOCKS + 1)]
    levels = [10 * math.log10(max(window, 1e-12)) for window in windows]
    stretches = range(ATTACK_BLOCKS, len(levels) - STRETCH_BLOCKS + WINDOW_BLOCKS)
    if not stretches:
        raise ValueError('the recording is too short for 5 s past its attack')
    mean_levels = {i: sum(levels[i:i + STRETCH_BLOCKS - WINDOW_BLOCKS]) / (STRETCH_BLOCKS - WINDOW_BLOCKS) for i in stretches}
    loudest = max(mean_levels.values())
    def movement(i):
        stretch = levels[i:i + STRETCH_BLOCKS - WINDOW_BLOCKS]
        return max(stretch) - min(stretch)
    return BLOCK_FRAMES * min((i for i in stretches if mean_levels[i] >= loudest - LOUDEST_STRETCH_DB), key=movement)


def pitch_cents(left, right, note):
    """Cents from the note to its centre: the time mean of the frequency of its strongest harmonics.

    The unwrapped phase of a harmonic gives that mean with no weight on the swells of the vibrato. Two
    boxcars one period long leave one harmonic, so only those whose vibrato fits that band are read.
    """
    decimation = SAMPLE_RATE // PITCH_RATE
    mono = [sum(left[i:i + decimation]) + sum(right[i:i + decimation]) for i in range(0, len(left), decimation)]
    hz = 440 * 2 ** ((note - 69) / 12)
    period = round(PITCH_RATE / hz)
    hop = max(1, period // 2)
    highest = max(hz, min(0.4 * PITCH_RATE, (hz / 2 - VIBRATO_HZ) / VIBRATO_REACH))
    harmonics = []
    for harmonic in range(1, int(highest / hz) + 1):
        turn = cmath.exp(-2j * cmath.pi * harmonic * hz / PITCH_RATE)
        phasor, base = 1 + 0j, []
        for value in mono:
            base.append(value * phasor)
            phasor *= turn
        for _ in range(2):
            total = sum(base[:period])
            smooth = [total]
            for i in range(period, len(base)):
                total += base[i] - base[i - period]
                smooth.append(total)
            base = smooth
        phase, power = 0.0, 0.0
        for previous, current in zip(base[::hop], base[hop::hop]):
            phase += cmath.phase(current * previous.conjugate())
            power += abs(current) ** 2
        seconds = hop * (len(base[::hop]) - 1) / PITCH_RATE
        offset = phase / (2 * math.pi * seconds)
        harmonics.append((power, 1200 * math.log2(1 + offset / (harmonic * hz))))
    strongest = sorted(harmonics, reverse=True)[:6]
    return sum(power * cents for power, cents in strongest) / sum(power for power, _ in strongest)


def tuned_stretch(path, note, key):
    """The steadiest 5 s of the recording, at the key, with its pitch centre on the key."""
    ratio = 2 ** ((key - note) / 12)
    left, right = decode(path, ratio)
    start = steadiest_start(left, right)
    for _ in range(TUNING_PASSES):
        stretch = left[start:start + STRETCH_FRAMES], right[start:start + STRETCH_FRAMES]
        cents = pitch_cents(*stretch, key)
        if abs(cents) <= TUNED_CENTS:
            return stretch
        ratio *= 2 ** (-cents / 1200)
        left, right = decode(path, ratio)
    raise ValueError(f'{path}: still {cents:.1f} cents off after {TUNING_PASSES} passes')


def looped(stretch):
    """4 s that close on themselves: the last second fades out over the first, which fades in."""
    loop = list(stretch[:LOOP_FRAMES])
    for i in range(CROSSFADE_FRAMES):
        position = i / CROSSFADE_FRAMES * math.pi / 2
        loop[i] = stretch[i] * math.sin(position) + stretch[LOOP_FRAMES + i] * math.cos(position)
    return loop


def scaled(channel, gain):
    return [v * gain for v in channel]


def rms(left, right):
    return math.sqrt((sum(v * v for v in left) + sum(v * v for v in right)) / (2 * len(left)))


def flatten(left, right):
    """Divides the loop by its level over 100 ms, on a gain that wraps with it."""
    for _ in range(FLATTEN_PASSES):
        energies = block_energies(left, right)
        count = len(energies)
        windows = [sum(energies[(i + offset) % count] for offset in range(WINDOW_BLOCKS)) for i in range(count)]
        mean = sum(windows) / count
        centre = WINDOW_BLOCKS // 2
        gains = [math.sqrt(mean / windows[(i - centre) % count]) for i in range(count)]
        for channel in (left, right):
            for i in range(len(channel)):
                block, fraction = divmod(i / BLOCK_FRAMES, 1)
                block = int(block)
                channel[i] *= gains[block] + fraction * (gains[(block + 1) % count] - gains[block])


def rotated(left, right):
    """The loop from its smallest step, because a low note's own steps can pass those of the 10 ms before a wrap."""
    start = min(range(1, LOOP_FRAMES), key=lambda i: max(abs(left[i] - left[i - 1]), abs(right[i] - right[i - 1])))
    return left[start:] + left[:start], right[start:] + right[:start]


def build_key(vsco, key):
    left, right = [0.0] * LOOP_FRAMES, [0.0] * LOOP_FRAMES
    for template, name, note, level in BANK[key]:
        path = vsco / template.format(name)
        if not path.is_file():
            sys.exit(f'{path}: not found')
        stretch = tuned_stretch(path, note, key)
        loop = looped(stretch[0]), looped(stretch[1])
        gain = 10 ** (level / 20) / rms(*loop)
        left = [mixed + v * gain for mixed, v in zip(left, loop[0])]
        right = [mixed + v * gain for mixed, v in zip(right, loop[1])]
    flatten(left, right)
    level = sum(10 ** (entry[3] / 10) for entry in BANK[key])
    gain = FULL_SCALE_RMS * math.sqrt(level) / rms(left, right)
    peak = max(max(abs(v) for v in left), max(abs(v) for v in right)) * gain
    if peak > HEADROOM_PEAK:
        raise ValueError(f'key {key} peaks at {peak:.3f}')
    return rotated(scaled(left, gain), scaled(right, gain))


def write_flac(path, left, right):
    frames = array.array('h', [0]) * (2 * (LOOP_FRAMES + 1))
    for i in range(LOOP_FRAMES + 1):
        frames[2 * i] = round(left[i % LOOP_FRAMES] * 32767)
        frames[2 * i + 1] = round(right[i % LOOP_FRAMES] * 32767)
    command = ['ffmpeg', '-nostdin', '-v', 'error', '-y', '-f', 's16le', '-ar', str(SAMPLE_RATE), '-ac', '2', '-i', '-',
               '-bitexact', '-map_metadata', '-1', '-c:a', 'flac', '-compression_level', '12', str(path)]
    subprocess.run(command, check=True, input=frames.tobytes())


def main():
    if len(sys.argv) != 3:
        sys.exit('Usage: build_orchestra_bank.py <VSCO folder> <output folder>')
    vsco, output = map(pathlib.Path, sys.argv[1:])
    output.mkdir(parents=True, exist_ok=True)
    for key in BANK:
        path = output / f'{NOTE_NAMES[key % 12]}{key // 12 - 1}.flac'
        write_flac(path, *build_key(vsco, key))
        print(f'{key} {path.name}: {path.stat().st_size / 1000000:.2f} MB')


if __name__ == '__main__':
    main()
