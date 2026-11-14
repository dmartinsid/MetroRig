"""Runs a suite and fails naming every test recorded at 591f031 that is missing or did not pass.

Usage: python3 -I tests/fixtures/tests_kept.py rust|js
       python3 -I tests/fixtures/tests_kept.py record   (rewrites kept_assertions_591f031.json from git)

The names come from kept_591f031.json. A Rust test may move to another module, so a recorded path
that is gone matches by its last segment; each recorded test must still map to its own passing test.
A vitest name is its describe titles and its own title joined by ' > ', whatever file holds it.

Each recorded test must also keep its assertions. kept_assertions_591f031.json holds every kept test's
assertion statements as `git show 591f031:<path>` printed them; the same statements are read from the
working tree, 591f031's side passes through NORMALIZE, and a test whose list differs fails by name.
A Rust assertion is each assert macro or assert_* call in the test function. A vitest assertion is
each outermost statement of the test that calls expect, read by ts_assertions.cjs.
"""
import json
import pathlib
import re
import subprocess
import sys
import tempfile

ROOT = pathlib.Path(__file__).resolve().parents[2]
RECORD = pathlib.Path(__file__).resolve().with_name('kept_591f031.json')
ASSERTIONS = pathlib.Path(__file__).resolve().with_name('kept_assertions_591f031.json')
TS_ASSERTIONS = pathlib.Path(__file__).resolve().with_name('ts_assertions.cjs')
BASE = '591f031'

# The only rewrites the move made inside assertions: engine fields that went into their layer's struct.
# Applied to 591f031's text, in order; nothing else may differ. No kept assertion names an import path
NORMALIZE = [
    (r'\bengine\.bpm\b', 'engine.clock.bpm'),
    (r'\bengine\.samples_per_step\b', 'engine.clock.samples_per_step'),
    (r'\bengine\.step_index\b', 'engine.pattern.step_index'),
    (r'\bengine\.click_mode\b', 'engine.click.mode'),
    (r'\}\.(bars|tracks|measure_length)\b', r'}.pattern.\1'),
    (r'\}\.(bank|fading)\b', r'}.drums.\1'),
]

# The kept assertions a later decision rewrote, each named: (suite, test, assertion at 591f031 after NORMALIZE, assertion now).
# AD-029 / TUP-17 (tuplets, Q21): a pattern holds 192 cells, not 128, so the grid refused past it is 193 steps long.
# Only these lines of these tests may differ; every other kept assertion still matches 591f031's.
# For the same reason kept_591f031.json's wasm_exports gained one name, engine_set_step_units (T8).
REWRITES = [
    ('rust', 'tests::holds_128_steps',
     'assert_eq!(unsafe { &*run.ptr }.pattern.tracks[1].steps[127], 2)',
     'assert_eq!(unsafe { &*run.ptr }.pattern.tracks[1].steps[191], 2)'),
    # The worklet mirrors the engine's 192 cells (T9), so it sends grids of 192 steps
    ('js', 'Worklet > reports every track of the kit on a tick',
     'expect(engine.exports.engine_update_grid).toHaveBeenCalledWith(1, 10, expect.any(Number), 128);',
     'expect(engine.exports.engine_update_grid).toHaveBeenCalledWith(1, 10, expect.any(Number), 192);'),
    ('js', 'Worklet > reports tracks 11 and 12 on a tick',
     'expect(engine.exports.engine_update_grid).toHaveBeenCalledWith(1, 12, expect.any(Number), 128);',
     'expect(engine.exports.engine_update_grid).toHaveBeenCalledWith(1, 12, expect.any(Number), 192);'),
    # AD-029 / TUP-18 (tuplets, Q22): the footer counts cells over the pattern's 192, so only the
    # denominator of each STEPS label moves from /128 to /192 (T15)
    ('js', "Display rules > steps label reads the pattern over the engine limit",
     "expect(formatSteps(16)).toBe('STEPS: 16/128');",
     "expect(formatSteps(16)).toBe('STEPS: 16/192');"),
    ('js', "Display rules > steps label reads the pattern over the engine limit",
     "expect(formatSteps(7)).toBe('STEPS: 7/128');",
     "expect(formatSteps(7)).toBe('STEPS: 7/192');"),
    ('js', "Display rules > steps label reads the pattern over the engine limit",
     "expect(formatSteps(64)).toBe('STEPS: 64/128');",
     "expect(formatSteps(64)).toBe('STEPS: 64/192');"),
    ('js', "Interface V2 > edge_02 steps follow",
     "expect(byId('pattern-steps').textContent).toBe('STEPS: 12/128');",
     "expect(byId('pattern-steps').textContent).toBe('STEPS: 12/192');"),
    ('js', "Interface V2 > edit_11 steps label",
     "expect(byId('pattern-steps').textContent).toBe('STEPS: 16/128');",
     "expect(byId('pattern-steps').textContent).toBe('STEPS: 16/192');"),
    ('js', "Interface V2 > edit_11 steps label",
     "expect(byId('pattern-steps').textContent).toBe('STEPS: 24/128');",
     "expect(byId('pattern-steps').textContent).toBe('STEPS: 24/192');"),
    ('js', "Interface V2 > edit_20 numerator stepper",
     "expect(byId('pattern-steps').textContent).toBe('STEPS: 20/128');",
     "expect(byId('pattern-steps').textContent).toBe('STEPS: 20/192');"),
    ('js', "Interface V2 > edit_21 denominator stepper",
     "expect(byId('pattern-steps').textContent).toBe('STEPS: 8/128');",
     "expect(byId('pattern-steps').textContent).toBe('STEPS: 8/192');"),
    ('js', "Song Bars > bars_07 saved song keeps four bars",
     "expect(byId('pattern-steps').textContent).toBe('STEPS: 64/128');",
     "expect(byId('pattern-steps').textContent).toBe('STEPS: 64/192');"),
    ('js', "Song Bars > count_04 steps over the limit",
     "expect(byId('pattern-steps').textContent).toBe('STEPS: 16/128');",
     "expect(byId('pattern-steps').textContent).toBe('STEPS: 16/192');"),
    ('js', "Song Bars > count_04 steps over the limit",
     "expect(byId('pattern-steps').textContent).toBe('STEPS: 64/128');",
     "expect(byId('pattern-steps').textContent).toBe('STEPS: 64/192');"),
    ('js', "Song Bars > count_06 limit of one bar",
     "expect(byId('pattern-steps').textContent).toBe('STEPS: 64/128');",
     "expect(byId('pattern-steps').textContent).toBe('STEPS: 64/192');"),
    ('js', "Song Bars > meter_01 asks first",
     "const confirmSpy = vi.fn(() => { // Nothing has changed when the question appears expect(byId('pattern-steps').textContent).toBe('STEPS: 64/128'); return false; });",
     "const confirmSpy = vi.fn(() => { // Nothing has changed when the question appears expect(byId('pattern-steps').textContent).toBe('STEPS: 64/192'); return false; });"),
    ('js', "Song Bars > meter_01 the same time signature changes nothing",
     "expect(byId('pattern-steps').textContent).toBe('STEPS: 64/128');",
     "expect(byId('pattern-steps').textContent).toBe('STEPS: 64/192');"),
    ('js', "Song Bars > meter_02 a longer bar still starts from bar one",
     "expect(byId('pattern-steps').textContent).toBe('STEPS: 20/128');",
     "expect(byId('pattern-steps').textContent).toBe('STEPS: 20/192');"),
    ('js', "Song Bars > meter_02 accept keeps bar one",
     "expect(byId('pattern-steps').textContent).toBe('STEPS: 12/128');",
     "expect(byId('pattern-steps').textContent).toBe('STEPS: 12/192');"),
    ('js', "Song Bars > meter_03 decline changes nothing",
     "expect(byId('pattern-steps').textContent).toBe('STEPS: 64/128');",
     "expect(byId('pattern-steps').textContent).toBe('STEPS: 64/192');"),
    # AD-030 (mobile-app, user: "Sim, abre no Stadium (Recommended)"): Stadium is the first screen link and opens a
    # first visit, so only the link order and the screen a first visit shows move (84dae55)
    ('js', "Grooves Library > nav_01 header links",
     "expect([...document.querySelectorAll('header nav button')].map(link => link.textContent)).toEqual(['Editor', 'Stadium', 'Grooves', 'Improv']);",
     "expect([...document.querySelectorAll('header nav button')].map(link => link.textContent)).toEqual(['Stadium', 'Editor', 'Grooves', 'Improv']);"),
    ('js', "Grooves Library > nav_05 aria current",
     "expect(current()).toEqual([['Editor', 'page']]);",
     "expect(current()).toEqual([['Stadium', 'page']]);"),
    ('js', "Improv > pad_30 link and title",
     "expect(links.map(link => link.textContent)).toEqual(['Editor', 'Stadium', 'Grooves', 'Improv']);",
     "expect(links.map(link => link.textContent)).toEqual(['Stadium', 'Editor', 'Grooves', 'Improv']);"),
    ('js', "Improv > pad_30 link and title",
     "expect(shownScreens()).toEqual(['editor-view']);",
     "expect(shownScreens()).toEqual(['stadium-view']);"),
    ('js', "StateManager > opens the Editor for an unknown stored mode",
     "expect(new StateManager().activeViewMode).toBe('editor');",
     "expect(new StateManager().activeViewMode).toBe('stadium');"),
    ('js', "StateManager Tests > should initialize with default state settings",
     "expect(stateManager.activeViewMode).toBe('editor');",
     "expect(stateManager.activeViewMode).toBe('stadium');"),
]


def rust_results():
    """Each Rust test's full path and whether it passed."""
    manifest = ROOT / 'engine' / 'Cargo.toml'
    command = ['cargo', 'test']
    if manifest.exists():
        command += ['--manifest-path', str(manifest)]
    run = subprocess.run(command, cwd=ROOT, capture_output=True, text=True)
    results = {}
    for line in run.stdout.splitlines():
        match = re.match(r'^test (\S+) \.\.\. (\w+)', line)
        if match:
            results[match.group(1)] = match.group(2) == 'ok'
    return results


def js_results():
    """Each vitest test's full name and whether it passed."""
    with tempfile.TemporaryDirectory() as folder:
        report = pathlib.Path(folder) / 'vitest.json'
        subprocess.run(['npx', 'vitest', 'run', '--reporter=json', f'--outputFile={report}'],
                       cwd=ROOT, capture_output=True, text=True)
        if not report.exists():
            return {}
        data = json.loads(report.read_text())
    results = {}
    for file in data['testResults']:
        for test in file['assertionResults']:
            name = ' > '.join(title for title in [*test['ancestorTitles'], test['title']] if title)
            results[name] = results.get(name, True) and test['status'] == 'passed'
    return results


def unmatched_rust(recorded, results):
    """Recorded names with no passing test of their own."""
    passing = {name for name, passed in results.items() if passed}
    used = set()
    missing = []
    for name in recorded:
        if name in passing and name not in used:
            used.add(name)
            continue
        last = name.split('::')[-1]
        candidates = [test for test in passing - used if test.split('::')[-1] == last]
        if len(candidates) == 1:
            used.add(candidates[0])
        else:
            missing.append(name)
    return missing


def squash(text):
    return re.sub(r'\s+', ' ', text).strip()


def masked_rust(source):
    """The source with comments, strings and char literals blanked, so braces and parens can be counted."""
    out = list(source)
    i = 0
    n = len(source)

    def blank(start, end):
        for k in range(start, end):
            if out[k] != '\n':
                out[k] = ' '

    while i < n:
        if source.startswith('//', i):
            end = source.find('\n', i)
            end = n if end < 0 else end
            blank(i, end)
            i = end
        elif source.startswith('/*', i):
            end = source.find('*/', i + 2)
            end = n if end < 0 else end + 2
            blank(i, end)
            i = end
        elif (raw := re.match(r'b?r(#*)"', source[i:])) and (i == 0 or not re.match(r'\w', source[i - 1])):
            close = '"' + raw.group(1)
            end = source.find(close, i + raw.end())
            end = n if end < 0 else end + len(close)
            blank(i + 1, end - 1)
            i = end
        elif source[i] == '"':
            j = i + 1
            while j < n and source[j] != '"':
                j += 2 if source[j] == '\\' else 1
            blank(i + 1, j)
            i = j + 1
        elif (char := re.match(r"'(\\.[^']*|[^\\'])'", source[i:])):
            blank(i + 1, i + char.end() - 1)
            i += char.end()
        else:
            i += 1
    return ''.join(out)


def closing(masked, start, opening, closer):
    """The index just past the bracket that closes the one at `start`."""
    depth = 0
    for i in range(start, len(masked)):
        if masked[i] == opening:
            depth += 1
        elif masked[i] == closer:
            depth -= 1
            if depth == 0:
                return i + 1
    return len(masked)


def rust_tests(files):
    """Each #[test] function's module path and its assertions; `files` maps a module prefix to source."""
    tests = {}
    for prefix, source in files:
        masked = masked_rust(source)
        modules = []
        for match in re.finditer(r'\bmod\s+(\w+)\s*\{', masked):
            start = match.end() - 1
            modules.append((start, closing(masked, start, '{', '}'), match.group(1)))
        for match in re.finditer(r'#\[test\]\s*(?:#\[[^\]]*\]\s*)*fn\s+(\w+)', masked):
            start = masked.index('{', match.end())
            end = closing(masked, start, '{', '}')
            inside = [name for (a, b, name) in sorted(modules) if a < match.start() < b]
            name = '::'.join([*prefix, *inside, match.group(1)])
            found = []
            position = start
            for call in re.finditer(r'\b(assert\w*)\s*!?\s*\(', masked[start:end]):
                at = start + call.start()
                if at < position:
                    continue
                position = closing(masked, start + call.end() - 1, '(', ')')
                found.append(squash(source[at:position]))
            tests[name] = found
    return tests


def module_prefix(relative):
    """`instruments/pad/voice.rs` is instruments::pad::voice; lib.rs and mod.rs name their folder."""
    parts = relative[:-3].split('/')
    return parts[:-1] if parts[-1] in ('lib', 'mod') else parts


def js_tests(paths):
    run = subprocess.run(['node', str(TS_ASSERTIONS), *map(str, paths)], cwd=ROOT,
                         capture_output=True, text=True, check=True)
    return json.loads(run.stdout)


def base_files(suffix):
    listed = subprocess.run(['git', 'ls-tree', '-r', '--name-only', BASE], cwd=ROOT,
                            capture_output=True, text=True, check=True).stdout.split()
    return {name: subprocess.run(['git', 'show', f'{BASE}:{name}'], cwd=ROOT, capture_output=True,
                                 text=True, check=True).stdout
            for name in listed if name.endswith(suffix)}


def base_assertions(suite, kept):
    """The kept tests' assertions as 591f031 holds them."""
    if suite == 'rust':
        files = [(module_prefix(name[len('src/'):]), text)
                 for name, text in base_files('.rs').items() if name.startswith('src/')]
        tests = rust_tests(files)
    else:
        with tempfile.TemporaryDirectory() as folder:
            paths = []
            for index, (name, text) in enumerate(sorted(base_files('.test.ts').items())):
                copy = pathlib.Path(folder) / f'{index}.test.ts'
                copy.write_text(text)
                paths.append(copy)
            tests = js_tests(paths)
    return {name: tests[match] for name in kept
            if (match := matching_name(name, tests)) is not None}


def head_assertions(suite):
    if suite == 'rust':
        crate = ROOT / 'engine' / 'src'
        return rust_tests([(module_prefix(path.relative_to(crate).as_posix()), path.read_text())
                           for path in sorted(crate.rglob('*.rs'))])
    return js_tests(sorted((ROOT / 'tests').rglob('*.test.ts')) + sorted((ROOT / 'src').rglob('*.test.ts')))


# Kept tests a later decision renamed, recorded name -> name now
# AD-030 (mobile-app): an unknown stored screen opens the Stadium, so the test's name says so (84dae55)
RENAMES = {
    'StateManager > opens the Editor for an unknown stored mode': 'StateManager > opens the Stadium for an unknown stored mode',
}


def matching_name(name, tests):
    """The test of that name (or the name it was renamed to), or for Rust the only one sharing its last segment."""
    name = RENAMES.get(name, name)
    if name in tests:
        return name
    if '::' not in name:
        return None
    candidates = [test for test in tests if test.split('::')[-1] == name.split('::')[-1]]
    return candidates[0] if len(candidates) == 1 else None


def normalized(lines):
    """591f031's assertions with the engine's fields where the move put them."""
    out = []
    for line in lines:
        for pattern, replacement in NORMALIZE:
            line = re.sub(pattern, replacement, line)
        out.append(line)
    return out


def rewritten(suite, name, lines):
    """The assertions with the REWRITES named for that test applied."""
    for rewrite_suite, test, old, new in REWRITES:
        if rewrite_suite == suite and test == name:
            lines = [new if line == old else line for line in lines]
    return lines


def changed_assertions(suite):
    """Kept tests whose assertions differ from 591f031's, or that hold none to compare."""
    recorded = json.loads(ASSERTIONS.read_text())[suite]
    head = head_assertions(suite)
    changed = []
    for name, lines in recorded.items():
        match = matching_name(name, head)
        if match is None or head[match] != rewritten(suite, name, normalized(lines)):
            changed.append(name)
    return changed


def record():
    kept = json.loads(RECORD.read_text())
    data = {suite: base_assertions(suite, kept[suite]) for suite in ('rust', 'js')}
    ASSERTIONS.write_text(json.dumps(data, indent=1, ensure_ascii=False) + '\n')
    for suite in ('rust', 'js'):
        print(f'{suite}: recorded the assertions of {len(data[suite])} of {len(kept[suite])} kept tests')
    return 0


def main():
    if len(sys.argv) != 2 or sys.argv[1] not in ('rust', 'js', 'record'):
        print('usage: tests_kept.py rust|js|record', file=sys.stderr)
        return 2
    suite = sys.argv[1]
    if suite == 'record':
        return record()
    recorded = json.loads(RECORD.read_text())[suite]
    if suite == 'rust':
        missing = unmatched_rust(recorded, rust_results())
    else:
        results = js_results()
        missing = [name for name in recorded if not results.get(RENAMES.get(name, name), False)]
    for name in missing:
        print(f'missing or not passing: {name}')
    print(f'{suite}: {len(recorded) - len(missing)} of {len(recorded)} recorded tests pass')
    changed = changed_assertions(suite)
    for name in changed:
        print(f'assertions changed since {BASE}: {name}')
    compared = len(json.loads(ASSERTIONS.read_text())[suite])
    print(f'{suite}: {compared - len(changed)} of {compared} recorded tests keep their assertions')
    return 1 if missing or changed else 0


if __name__ == '__main__':
    sys.exit(main())
