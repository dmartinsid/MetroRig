"""The pad banks as src/domain/chords.ts lists them in PAD_TIMBRES, shared by the proofs of the shipped files.

The proofs run under `python3 -I`, which leaves this folder off sys.path, so each loads this file by its path.
"""
import pathlib
import re
import subprocess
import sys

ROOT = pathlib.Path(__file__).resolve().parents[2]
ENTRY = re.compile(r"\{\s*key:\s*(\d+),\s*url:\s*'([^']+)',\s*loopStart:\s*(\d+),\s*loopEnd:\s*(\d+)\s*\}")
TIMBRE = re.compile(r"\{\s*name:\s*'([^']+)',\s*files:\s*(\w+|\[\]),\s*bass:\s*(?:true|false)\s*\}")
BANK_SIZES = {'Choir': 5, 'New Age': 9, 'Orchestra': 14, 'Sweep': 9, 'Analog': 0}


def read_banks():
    """Each timbre's (key, url, loop start, loop end) entries, as strings, in the order of PAD_TIMBRES."""
    source = (ROOT / 'src/domain/chords.ts').read_text()
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


def path_of(url):
    return ROOT / 'public' / url.lstrip('/')


def channels(path):
    probe = ['ffprobe', '-v', 'error', '-show_entries', 'stream=channels', '-of', 'csv=p=0', str(path)]
    return int(subprocess.run(probe, check=True, capture_output=True, text=True).stdout.split(',')[0])


def ffmpeg(path, arguments, output_format):
    """The raw samples ffmpeg writes for the file in the given format, after the given arguments."""
    command = ['ffmpeg', '-nostdin', '-v', 'error', '-i', str(path), *arguments, '-f', output_format, '-']
    return subprocess.run(command, check=True, capture_output=True).stdout
