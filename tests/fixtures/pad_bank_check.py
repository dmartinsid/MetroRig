"""Decodes each file of every bank in PAD_TIMBRES and fails if a loop wrap breaks TIM-21.

The tables are read from src/chords.ts, so this proof follows what the engine is given. A wrap goes
from loop_end to loop_start, and loop_end is inclusive: its sample stands for loop_start's, so the
frame played before the wrap is loop_end - 1. No channel may step there above its largest step in the
10 ms before. New Age keeps the bound it shipped with: loop_end's sample equals loop_start's.
"""
import array
import pathlib
import re
import subprocess
import sys

ROOT = pathlib.Path(__file__).resolve().parents[2]
ENTRY = re.compile(r"\{\s*key:\s*(\d+),\s*url:\s*'([^']+)',\s*loopStart:\s*(\d+),\s*loopEnd:\s*(\d+)\s*\}")
TIMBRE = re.compile(r"\{\s*name:\s*'([^']+)',\s*files:\s*(\w+|\[\]),\s*bass:\s*(?:true|false)\s*\}")
BANK_SIZES = {'Choir': 5, 'New Age': 8, 'Orchestra': 0, 'Sweep': 8, 'Analog': 0}
EXACT_BANKS = ('New Age',)
TEN_MS = 441


def read_banks():
    source = (ROOT / 'src/chords.ts').read_text()
    block = re.search(r'PAD_TIMBRES\b[^=]*=\s*\[(.*?)\];', source, re.S)
    timbres = TIMBRE.findall(block.group(1)) if block else []
    if [name for name, _ in timbres] != list(BANK_SIZES):
        sys.exit(f'PAD_TIMBRES: expected {list(BANK_SIZES)}, parsed {[name for name, _ in timbres]}')
    banks = {}
    for name, files in timbres:
        table = re.search(rf'\b{files}\b[^=]*=\s*\[(.*?)\];', source, re.S) if files != '[]' else None
        entries = ENTRY.findall(table.group(1)) if table else []
        if len(entries) != BANK_SIZES[name]:
            sys.exit(f'{name}: expected {BANK_SIZES[name]} entries, parsed {len(entries)}')
        banks[name] = entries
    return banks


def decode(path):
    """Each channel of the file."""
    channels = int(subprocess.run(['ffprobe', '-v', 'error', '-show_entries', 'stream=channels', '-of', 'csv=p=0',
                                   str(path)], check=True, capture_output=True, text=True).stdout.split(',')[0])
    raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', str(path), '-f', 's16le', '-'],
                         check=True, capture_output=True).stdout
    samples = array.array('h')
    samples.frombytes(raw)
    return [samples[channel::channels] for channel in range(channels)]


def check(bank, url, start, end):
    """The problems of one file, and its largest step at the wrap."""
    problems, wrap = [], 0
    for samples in decode(ROOT / 'public' / url.lstrip('/')):
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
    for bank, entries in read_banks().items():
        for key, url, loop_start, loop_end in entries:
            found, wrap = check(bank, url, int(loop_start), int(loop_end))
            problems += found
            print(f'{bank} {key} {url}: wrap step {wrap}')
    if problems:
        sys.exit('\n'.join(problems))


main()
