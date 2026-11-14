"""Reads the drum track of a Guitar Pro file and prints measures in Songsterr's JSON shape, which
scripts/tab_to_grid.js turns into MetroRig's grid. A development tool: the app never calls it.

Usage: python3 -I scripts/gp_extract.py <file.gp|file.gpx> <first measure> [count]

A .gp (Guitar Pro 7 and 8) is a zip holding Content/score.gpif. A .gpx (Guitar Pro 6) is a BCFZ file:
a bit-packed compression of a BCFS file system that holds score.gpif. The output is
{ first, tempo, measures, automations }, the measures counted from the first one asked for, the first
carrying its time signature, so `node scripts/tab_to_grid.js <output.json> 0` prints the grid.
"""
import json
import sys
import xml.etree.ElementTree as ET
import zipfile

SECTOR = 0x1000


class Bits:
    """Reads a byte string bit by bit, high bit first."""

    def __init__(self, data):
        self.data = data
        self.position = 0  # In bits

    def bit(self):
        byte = self.data[self.position >> 3]
        value = (byte >> (7 - (self.position & 7))) & 1
        self.position += 1
        return value

    def bits(self, count):
        value = 0
        for _ in range(count):
            value = (value << 1) | self.bit()
        return value

    def bits_reversed(self, count):
        value = 0
        for shift in range(count):
            value |= self.bit() << shift
        return value


def bcfz(data):
    """The BCFS image a BCFZ file compresses: literal runs, and copies of bytes already written."""
    if data[:4] != b'BCFZ':
        raise ValueError('Not a BCFZ file')
    expected = int.from_bytes(data[4:8], 'little')
    reader = Bits(data[8:])
    out = bytearray()
    while len(out) < expected:
        if reader.bit():
            size_bits = reader.bits(4)
            offset = reader.bits_reversed(size_bits)
            size = reader.bits_reversed(size_bits)
            start = len(out) - offset
            out += out[start:start + min(offset, size)]
        else:
            size = reader.bits_reversed(2)
            for _ in range(size):
                out.append(reader.bits(8))
    return bytes(out[:expected])


def bcfs_files(image):
    """Each file of a BCFS image by name: entries of type 2 sit one per sector and list the sectors of their data."""
    if image[:4] != b'BCFS':
        raise ValueError('Not a BCFS file system')
    data = image[4:]
    word = lambda at: int.from_bytes(data[at:at + 4], 'little')
    files = {}
    offset = SECTOR
    while offset + 3 < len(data):
        if word(offset) == 2:
            name = data[offset + 4:offset + 4 + 127].split(b'\0')[0].decode('latin-1')
            size = word(offset + 0x8C)
            content = bytearray()
            pointer = offset + 0x94
            while (sector := word(pointer)) != 0:
                content += data[sector * SECTOR:(sector + 1) * SECTOR]
                pointer += 4
            files[name] = bytes(content[:size])
        offset += SECTOR
    return files


def read_gpif(path):
    with open(path, 'rb') as handle:
        head = handle.read(4)
    if head == b'BCFZ':
        with open(path, 'rb') as handle:
            files = bcfs_files(bcfz(handle.read()))
        if 'score.gpif' not in files:
            raise ValueError('No score.gpif in the file system')
        return files['score.gpif']
    with zipfile.ZipFile(path) as archive:
        return archive.read('Content/score.gpif')


# Guitar Pro 6 names a drum piece by Element and Variation (alphaTab's table), as General MIDI notes
GP6_DRUMS = {
    (0, 0): 35,  # Kick
    (1, 0): 38, (1, 1): 91, (1, 2): 37,  # Snare: hit, rim shot, side stick
    (2, 0): 37,  # Snare side stick
    (5, 0): 41,  # Very low floor tom
    (6, 0): 43,  # Low floor tom
    (7, 0): 45,  # Low tom
    (8, 0): 47,  # Mid tom
    (9, 0): 50,  # High tom
    (10, 0): 42, (10, 1): 92, (10, 2): 46,  # Hi-hat: closed, half, open
    (11, 0): 44,  # Pedal hi-hat
    (12, 0): 49,  # Crash medium
    (13, 0): 57,  # Crash high
    (14, 0): 55,  # Splash
    (15, 0): 51, (15, 1): 53, (15, 2): 59,  # Ride: middle, bell, edge
    (16, 0): 52,  # China
}

NOTE_VALUES = {'Whole': 1, 'Half': 2, 'Quarter': 4, 'Eighth': 8, '16th': 16, '32nd': 32, '64th': 64, '128th': 128}


def by_id(root, path):
    return {node.get('id'): node for node in root.findall(path)}


def ids(node, tag):
    text = node.findtext(tag) or ''
    return [part for part in text.split() if part != '-1']


def prop(note, name):
    for item in note.findall('Properties/Property'):
        if item.get('name') == name:
            return item
    return None


def is_drum_track(track):
    instrument = track.find('Instrument')
    if instrument is not None and instrument.get('ref', '').startswith('drm'):
        return True
    return (track.findtext('InstrumentSet/Type') or '') == 'drumKit'


def drum_note(note):
    """A note as Songsterr writes it: the piece as a MIDI number, and its dynamics"""
    midi = prop(note, 'Midi')
    if midi is not None:
        fret = int(midi.findtext('Number'))
    else:
        element = prop(note, 'Element')
        variation = prop(note, 'Variation')
        key = (int(element.findtext('Element')), int(variation.findtext('Variation')) if variation is not None else 0)
        if key not in GP6_DRUMS:
            raise ValueError(f'No piece for drum element {key[0]} variation {key[1]}')
        fret = GP6_DRUMS[key]
    out = {'fret': fret}
    if note.findtext('AntiAccent') == 'Normal':
        out['ghost'] = True
    if int(note.findtext('Accent') or 0) & (4 | 8):  # Heavy accent or accent
        out['accentuated'] = True
    tie = note.find('Tie')
    if tie is not None and tie.get('destination') == 'true':
        out['tie'] = True
    return out


def drum_beat(beat, rhythms, notes):
    rhythm = rhythms[beat.find('Rhythm').get('ref')]
    out = {'duration': [1, NOTE_VALUES[rhythm.findtext('NoteValue')]]}
    dot = rhythm.find('AugmentationDot')
    if dot is not None:
        out['dots'] = int(dot.get('count'))
    tuplet = rhythm.find('PrimaryTuplet')
    if tuplet is not None:
        out['tuplet'] = int(tuplet.get('num'))
    if beat.find('GraceNotes') is not None:
        out['graceNote'] = True
    note_ids = ids(beat, 'Notes')
    if note_ids:
        out['notes'] = [drum_note(notes[note_id]) for note_id in note_ids]
    else:
        out['rest'] = True
        out['notes'] = [{'rest': True}]
    return out


def tempo_at(root, measure):
    """The tempo in force at a measure: the last tempo automation at or before it"""
    tempo = None
    for automation in root.findall('MasterTrack/Automations/Automation'):
        if automation.findtext('Type') == 'Tempo' and int(automation.findtext('Bar')) <= measure:
            tempo = round(float(automation.findtext('Value').split()[0]))
    return tempo


def extract(path, first, count=4):
    root = ET.fromstring(read_gpif(path))
    tracks = root.findall('Tracks/Track')
    drums = [index for index, track in enumerate(tracks) if is_drum_track(track)]
    if not drums:
        raise ValueError('No drum track')
    track = drums[0]

    master_bars = root.findall('MasterBars/MasterBar')
    if first + count > len(master_bars):
        raise ValueError(f'The file ends before measure {first + count}')
    bars, voices, beats = by_id(root, 'Bars/Bar'), by_id(root, 'Voices/Voice'), by_id(root, 'Beats/Beat')
    rhythms, notes = by_id(root, 'Rhythms/Rhythm'), by_id(root, 'Notes/Note')

    measures = []
    signature = None
    for index in range(first, first + count):
        master = master_bars[index]
        own = [int(part) for part in master.findtext('Time').split('/')]
        bar = bars[master.findtext('Bars').split()[track]]
        measure = {'voices': [{'beats': [drum_beat(beats[beat_id], rhythms, notes) for beat_id in ids(voices[voice_id], 'Beats')]}
                              for voice_id in ids(bar, 'Voices')]}
        if own != signature:
            measure = {'signature': own, **measure}
            signature = own
        measures.append(measure)

    tempo = tempo_at(root, first)
    return {'first': first, 'tempo': tempo, 'measures': measures, 'automations': {'tempo': [{'measure': 0, 'bpm': tempo}]}}


def main():
    if len(sys.argv) not in (3, 4):
        print('usage: gp_extract.py <file.gp|file.gpx> <first measure> [count]', file=sys.stderr)
        return 2
    count = int(sys.argv[3]) if len(sys.argv) == 4 else 4
    try:
        print(json.dumps(extract(sys.argv[1], int(sys.argv[2]), count)))
    except ValueError as error:
        print(error, file=sys.stderr)
        return 1
    return 0


if __name__ == '__main__':
    sys.exit(main())
