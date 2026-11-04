"""Decodes each file of every bank in PAD_TIMBRES and fails if a loop wrap breaks TIM-21.

The tables are read from src/chords.ts, so this proof follows what the engine is given. A wrap goes
from loop_end to loop_start, and loop_end is inclusive: its sample stands for loop_start's, so the
frame played before the wrap is loop_end - 1. No channel may step there above its largest step in the
10 ms before. New Age keeps the bound it shipped with: loop_end's sample equals loop_start's.
"""
import array
import importlib.util
import pathlib
import sys


def load_pad_files():
    """tests/fixtures/pad_files.py, by its path: -I leaves this folder off sys.path."""
    path = pathlib.Path(__file__).resolve().with_name('pad_files.py')
    spec = importlib.util.spec_from_file_location('pad_files', path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


pad_files = load_pad_files()
EXACT_BANKS = ('New Age',)
TEN_MS = 441


def decode(path):
    """Each channel of the file."""
    count = pad_files.channels(path)
    samples = array.array('h')
    samples.frombytes(pad_files.ffmpeg(path, [], 's16le'))
    return [samples[channel::count] for channel in range(count)]


def check(bank, url, start, end):
    """The problems of one file, and its largest step at the wrap."""
    problems, wrap = [], 0
    for samples in decode(pad_files.path_of(url)):
        if len(samples) <= end:
            return [f'{url}: the loop ends past the file'], wrap
        last = end - 1
        before = max(abs(samples[frame] - samples[frame - 1]) for frame in range(last - TEN_MS, last + 1))
        step = abs(samples[start] - samples[last])
        wrap = max(wrap, step)
        if step > before:
            problems.append(f'{url}: wrap step {step} above {before}')
        if bank in EXACT_BANKS and samples[start] != samples[end]:
            problems.append(f'{url}: loop end differs from loop start by {abs(samples[start] - samples[end])}')
    return problems, wrap


def main():
    problems = []
    for bank, entries in pad_files.read_banks().items():
        for key, url, loop_start, loop_end in entries:
            found, wrap = check(bank, url, int(loop_start), int(loop_end))
            problems += found
            print(f'{bank} {key} {url}: wrap step {wrap}')
    if problems:
        sys.exit('\n'.join(problems))


main()
