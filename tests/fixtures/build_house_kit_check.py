"""Runs scripts/build_house_kit.py on made-up recordings and prints how its files compare, as JSON.

Blend, Close and Room each get their own level or signal, so a layer that is missing, at the
wrong gain or at the wrong time shows up as a difference. Snare's Close starts 5 frames late; Room 30.
"""
import json
import pathlib
import sys
import tempfile
import wave

sys.dont_write_bytecode = True
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[2] / 'scripts'))
import array  # noqa: E402

import build_house_kit as builder  # noqa: E402

FRAMES = 4000
COMPARED = 3500  # Short of the tail fade
LEVELS = {'Soft': 0.25, 'Med': 0.5, 'Hard': 1.0, 'Crack': 0.9}
# Close shares Blend's signal, as the real mics do, so lining it up has something to find
MICS = {'Blend': (8000, 7919, 0), 'Close': (4000, 7919, 0), 'Room': (2000, 4507, 30)}
filters = {}


def noise(seed, frame):
    return ((frame * frame * seed + frame * 31) % 2001 - 1000) / 1000 if frame >= 0 else 0.0


def signal(mic, recording, frame, late=0):
    size, seed, delay = MICS[mic]
    return LEVELS[recording] * size * noise(seed, frame - delay - late)


def fake_decode(path, audio_filter=None):
    path = pathlib.PurePath(path)
    mic, piece = path.parent.name, path.parts[-3]
    recording = path.stem.rsplit(' ', 1)[0]
    filters[f'{piece}/{mic}'] = audio_filter
    late = 5 if piece == 'Snare' and mic == 'Close' else 0
    samples = array.array('h')
    for frame in range(FRAMES):
        value = round(signal(mic, recording, frame, late))
        samples.extend((value, value))
    return samples


def read(path):
    with wave.open(str(path)) as source:
        samples = array.array('h')
        samples.frombytes(source.readframes(source.getnframes()))
    return samples[::2]


def expected(piece, recording, frame):
    value = signal('Blend', recording, frame)
    if piece in ('kick', 'snare'):
        value += signal('Close', recording, frame) + 0.5 * signal('Room', recording, frame)
    return value


def main():
    builder.decode = fake_decode
    result = {}
    with tempfile.TemporaryDirectory() as output:
        sys.argv = ['build_house_kit.py', 'kit', output]
        builder.main()
        for piece, (_, recordings) in builder.PIECES.items():
            peak = max(abs(expected(piece, recording, frame)) for recording in recordings
                       for frame in range(FRAMES))
            gain = 32767 / peak if piece in ('kick', 'snare') else 1.0
            worst, loudest = 0.0, 0
            for recording in recordings:
                for take in builder.TAKES:
                    made = read(pathlib.Path(output) / piece / f'{recording.lower()}-{take}.wav')
                    loudest = max(loudest, max(abs(value) for value in made))
                    worst = max(worst, max(abs(made[frame] - gain * expected(piece, recording, frame))
                                           for frame in range(COMPARED)))
            result[piece] = {'worst': worst, 'loudest': loudest}
    print(json.dumps({'pieces': result, 'filters': filters}))


main()
