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


# Guitar Pro 6 names a drum piece by Element and Variation: alphaTab's table (PercussionMapper.ts,
# gp6ElementAndVariationToArticulation), as Guitar Pro 7 articulations: General MIDI notes, plus 91 rim shot,
# 92 half-open hat, 93 ride edge, 95-98 chokes, 99, 100, 102 and 103 cowbells, 127 ride bell
GP6_ARTICULATIONS = [
    (35, 35, 35),  # 0 Kick: hit, unused, unused
    (38, 91, 37),  # 1 Snare: hit, rim shot, side stick
    (99, 100, 99),  # 2 Cowbell low: hit, tip, unused
    (56, 100, 56),  # 3 Cowbell medium: hit, tip, unused
    (102, 103, 102),  # 4 Cowbell high: hit, tip, unused
    (43, 43, 43),  # 5 Tom very low
    (45, 45, 45),  # 6 Tom low
    (47, 47, 47),  # 7 Tom medium
    (48, 48, 48),  # 8 Tom high
    (50, 50, 50),  # 9 Tom very high
    (42, 92, 46),  # 10 Hi-hat: closed, half, open
    (44, 44, 44),  # 11 Pedal hi-hat
    (57, 98, 57),  # 12 Crash medium: hit, choke, unused
    (49, 97, 49),  # 13 Crash high: hit, choke, unused
    (55, 95, 55),  # 14 Splash: hit, choke, unused
    (51, 93, 127),  # 15 Ride: middle, edge, bell
    (52, 96, 52),  # 16 China: hit, choke, unused
]
GP6_DRUMS = {(element, variation): articulation
             for element, variations in enumerate(GP6_ARTICULATIONS)
             for variation, articulation in enumerate(variations)}

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
