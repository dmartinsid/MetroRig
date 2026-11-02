"""Proofs of the Orchestra bank, each with its own flag.

--pitch   TIM-17: every file's pitch centre sits within 10 cents of its key
--level   TIM-22: across every loop, the level holds within 1.5 dB over windows of 100 ms
--repeat  TIM-25: two builder runs give the same bytes, and they are the shipped files

--pitch and --level read the files of PAD_TIMBRES, so they follow what the engine is given. --pitch
measures with the long-term spectrum, not with the builder's phase, so a mistake in one does not hide in
both, and it proves its meter first on a vibrato with a known centre and on a shipped file detuned by 30 cents.
--repeat needs the VSCO recordings: it reads the folder in the VSCO_DIR environment variable, by
default ~/.cache/metrorig/vsco-2-ce, which holds https://github.com/sgossner/VSCO-2-CE or the files the builder
names. It exits non-zero if they are missing.
"""
import argparse
import array
import cmath
import math
import os
import pathlib
import re
import subprocess
import sys
import tempfile

ROOT = pathlib.Path(__file__).resolve().parents[2]
BUILDER = ROOT / 'scripts/build_orchestra_bank.py'
DEFAULT_VSCO = pathlib.Path.home() / '.cache/metrorig/vsco-2-ce'
ENTRY = re.compile(r"\{\s*key:\s*(\d+),\s*url:\s*'([^']+)',\s*loopStart:\s*(\d+),\s*loopEnd:\s*(\d+)\s*\}")
ORCHESTRA = re.compile(r"\{\s*name:\s*'Orchestra',\s*files:\s*(\w+),")
BANK_SIZE = 13
SAMPLE_RATE = 44100

PITCH_LIMIT_CENTS = 10
METER_RATE = 11025
METER_FRAMES = 8192
BAND_CENTS = 60  # Holds a vibrato of about 40 cents, and stays clear of the next harmonic up to harmonic 12
LOWEST_HZ = 150
HIGHEST_HZ = 3000
HIGHEST_HARMONIC = 12
KNOWN_CENTRE_CENTS = 7
METER_TOLERANCE_CENTS = 2
PROOF_DETUNE_CENTS = 30
PROOF_TOLERANCE_CENTS = 5

LEVEL_LIMIT_DB = 1.5
LEVEL_WINDOW = SAMPLE_RATE // 10
LEVEL_HOP = SAMPLE_RATE // 100


def read_bank():
    source = (ROOT / 'src/chords.ts').read_text()
    timbre = ORCHESTRA.search(source)
    table = re.search(rf'\b{timbre.group(1)}\b[^=]*=\s*\[(.*?)\];', source, re.S) if timbre else None
    entries = ENTRY.findall(table.group(1)) if table else []
    if len(entries) != BANK_SIZE:
        sys.exit(f'Orchestra: expected {BANK_SIZE} entries, parsed {len(entries)}')
    return [(int(key), ROOT / 'public' / url.lstrip('/')) for key, url, _, _ in entries]


def decode(path, arguments):
    command = ['ffmpeg', '-nostdin', '-v', 'error', '-i', str(path), *arguments, '-c:a', 'pcm_f32le', '-f', 'f32le', '-']
    samples = array.array('f')
    samples.frombytes(subprocess.run(command, check=True, capture_output=True).stdout)
    return samples


def fft(values):
    size = len(values)
    if size == 1:
        return values
    even, odd = fft(values[0::2]), fft(values[1::2])
    turned = [cmath.exp(-2j * math.pi * i / size) * odd[i] for i in range(size // 2)]
    return [e + t for e, t in zip(even, turned)] + [e - t for e, t in zip(even, turned)]


def long_term_spectrum(samples):
    window = [0.5 - 0.5 * math.cos(2 * math.pi * i / METER_FRAMES) for i in range(METER_FRAMES)]
    power = [0.0] * (METER_FRAMES // 2 + 1)
    for start in range(0, len(samples) - METER_FRAMES + 1, METER_FRAMES // 2):
        spectrum = fft([samples[start + i] * window[i] + 0j for i in range(METER_FRAMES)])
        for i in range(len(power)):
            power[i] += abs(spectrum[i]) ** 2
    return power


def band_centre(power, centre):
    """The centre of a harmonic's power, and that power. The band follows the centre, so its edges carry no bias."""
    width = 2 ** (BAND_CENTS / 1200)
    step = METER_RATE / METER_FRAMES
    for _ in range(4):
        low, high = round(centre / width / step), round(centre * width / step)
        floor = min(power[low:high + 1])
        heights = [(i * step, power[i] - floor) for i in range(low, high + 1)]
        total = sum(height for _, height in heights)
        centre = sum(hz * height for hz, height in heights) / total
    return centre, total


def pitch_centre_cents(samples, key):
    """Cents from the key to the centre of the file, over its harmonics, by power."""
    power = long_term_spectrum(samples)
    hz = 440 * 2 ** ((key - 69) / 12)
    harmonics = [h for h in range(1, HIGHEST_HARMONIC + 1) if LOWEST_HZ <= h * hz <= HIGHEST_HZ]
    centres = [band_centre(power, h * hz) for h in harmonics]
    offsets = [1200 * math.log2(centre / (h * hz)) for h, (centre, _) in zip(harmonics, centres)]
    weights = [weight for _, weight in centres]
    return sum(offset * weight for offset, weight in zip(offsets, weights)) / sum(weights)


def known_vibrato(key):
    """5 s at KNOWN_CENTRE_CENTS above the key, swinging 30 cents at 5.5 Hz on 8 harmonics."""
    hz = 440 * 2 ** ((key + KNOWN_CENTRE_CENTS / 100 - 69) / 12)
    harmonics = range(max(1, math.ceil(LOWEST_HZ / hz)), HIGHEST_HARMONIC + 1)
    phases = dict.fromkeys(harmonics, 0.0)
    samples = []
    for frame in range(5 * METER_RATE):
        now = hz * 2 ** (30 * math.sin(2 * math.pi * 5.5 * frame / METER_RATE) / 1200)
        value = 0.0
        for harmonic in harmonics:
            phases[harmonic] += 2 * math.pi * harmonic * now / METER_RATE
            value += math.sin(phases[harmonic]) / harmonic
        samples.append(value)
    return samples


def prove_the_meter(bank):
    for key in (bank[0][0], bank[-1][0]):
        reading = pitch_centre_cents(known_vibrato(key), key)
        print(f'meter: key {key} with a known centre of {KNOWN_CENTRE_CENTS} cents reads {reading:+.1f}')
        if abs(reading - KNOWN_CENTRE_CENTS) > METER_TOLERANCE_CENTS:
            sys.exit('the meter misreads a known vibrato')
    key, path = bank[len(bank) // 2]
    plain = pitch_centre_cents(decode(path, ['-ac', '1', '-ar', str(METER_RATE)]), key)
    speed = round(SAMPLE_RATE * 2 ** (PROOF_DETUNE_CENTS / 1200))
    detuned = decode(path, ['-af', f'asetrate={speed},aresample={METER_RATE}', '-ac', '1'])
    reading = pitch_centre_cents(detuned, key)
    print(f'meter: key {key} detuned by {PROOF_DETUNE_CENTS} cents reads {reading:+.1f}, from {plain:+.1f}')
    if abs(reading - plain - PROOF_DETUNE_CENTS) > PROOF_TOLERANCE_CENTS or abs(reading) <= PITCH_LIMIT_CENTS:
        sys.exit('the meter does not see a detuned file')


def check_pitch():
    bank = read_bank()
    prove_the_meter(bank)
    worst = 0.0
    for key, path in bank:
        cents = pitch_centre_cents(decode(path, ['-ac', '1', '-ar', str(METER_RATE)]), key)
        print(f'{key} {path.name}: {cents:+.1f} cents')
        worst = max(worst, abs(cents))
    if worst > PITCH_LIMIT_CENTS:
        sys.exit(f'a pitch centre sits {worst:.1f} cents off, past {PITCH_LIMIT_CENTS}')


def level_range(samples):
    """The distance in dB between the loudest and the quietest 100 ms of the loop, wrapping around it."""
    frames = len(samples) // 2 - 1  # The last frame repeats the first
    energy = [samples[2 * i] ** 2 + samples[2 * i + 1] ** 2 for i in range(frames)]
    energy += energy[:LEVEL_WINDOW]
    total = sum(energy[:LEVEL_WINDOW])
    levels = []
    for start in range(frames):
        if start % LEVEL_HOP == 0:
            levels.append(10 * math.log10(max(total, 1e-12)))
        total += energy[start + LEVEL_WINDOW] - energy[start]
    return max(levels) - min(levels)


def check_level():
    worst = 0.0
    for key, path in read_bank():
        moved = level_range(decode(path, ['-ac', '2']))
        print(f'{key} {path.name}: level moves {moved:.2f} dB')
        worst = max(worst, moved)
    if worst > LEVEL_LIMIT_DB:
        sys.exit(f'a loop moves {worst:.2f} dB, past {LEVEL_LIMIT_DB}')


def build(vsco, output):
    subprocess.run([sys.executable, '-I', str(BUILDER), str(vsco), str(output)], check=True, stdout=subprocess.DEVNULL)
    return {path.name: path.read_bytes() for path in output.iterdir()}


def check_repeat():
    vsco = pathlib.Path(os.environ.get('VSCO_DIR', DEFAULT_VSCO))
    if not vsco.is_dir():
        sys.exit(f'{vsco}: no VSCO recordings here. Set VSCO_DIR, or clone https://github.com/sgossner/VSCO-2-CE there')
    with tempfile.TemporaryDirectory() as folder:
        first = build(vsco, pathlib.Path(folder) / 'first')
        second = build(vsco, pathlib.Path(folder) / 'second')
    if len(first) != BANK_SIZE:
        sys.exit(f'the builder wrote {len(first)} files, expected {BANK_SIZE}')
    if first != second:
        sys.exit(f'two runs differ on {[name for name in first if first[name] != second.get(name)]}')
    shipped = {path.name: path.read_bytes() for _, path in read_bank()}
    if first != shipped:
        sys.exit(f'the shipped files differ on {[name for name in first if first[name] != shipped.get(name)]}')
    print(f'two runs give the same {len(first)} files, which are the shipped ones')


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    for flag in ('--pitch', '--level', '--repeat'):
        parser.add_argument(flag, action='store_true')
    flags = parser.parse_args()
    if not (flags.pitch or flags.level or flags.repeat):
        parser.error('name at least one of --pitch, --level, --repeat')
    if flags.pitch:
        check_pitch()
    if flags.level:
        check_level()
    if flags.repeat:
        check_repeat()


if __name__ == '__main__':
    main()
