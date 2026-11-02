"""Decodes each file of PAD_BANK and fails if its loop wrap takes a step above 0.

The sample table is read from src/chords.ts, so this proof follows what the engine is given. A wrap
goes from loop_end to loop_start, and loop_end is inclusive.
"""
import pathlib
import re
import struct
import subprocess
import sys

ROOT = pathlib.Path(__file__).resolve().parents[2]
ENTRY = re.compile(r"\{\s*key:\s*(\d+),\s*url:\s*'([^']+)',\s*loopStart:\s*(\d+),\s*loopEnd:\s*(\d+)\s*\}")
BANK_SIZE = 8


def read_bank():
    source = (ROOT / 'src/chords.ts').read_text()
    bank = re.search(r'PAD_BANK\b[^=]*=\s*\[(.*?)\];', source, re.S)
    entries = ENTRY.findall(bank.group(1)) if bank else []
    if len(entries) != BANK_SIZE:
        sys.exit(f'PAD_BANK: expected {BANK_SIZE} entries, parsed {len(entries)}')
    return entries


def decode(path):
    return subprocess.run(['ffmpeg', '-v', 'error', '-i', str(path), '-f', 's16le', '-ac', '1', '-'],
                          check=True, capture_output=True).stdout


def main():
    worst = 0
    for key, url, loop_start, loop_end in read_bank():
        pcm = decode(ROOT / 'public' / url.lstrip('/'))
        start, end = int(loop_start), int(loop_end)
        if len(pcm) < 2 * (end + 1):
            sys.exit(f'{url}: the loop ends past the file')
        first, last = (struct.unpack_from('<h', pcm, 2 * frame)[0] for frame in (start, end))
        step = abs(first - last)
        worst = max(worst, step)
        print(f'{key} {url}: loop step {step}')
    if worst > 0:
        sys.exit(f'largest loop step {worst}, expected 0')


main()
