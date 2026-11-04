"""Runs a suite and fails naming every test recorded at 591f031 that is missing or did not pass.

Usage: python3 -I tests/fixtures/tests_kept.py rust|js

The names come from kept_591f031.json. A Rust test may move to another module, so a recorded path
that is gone matches by its last segment; each recorded test must still map to its own passing test.
A vitest name is its describe titles and its own title joined by ' > ', whatever file holds it.
"""
import json
import pathlib
import re
import subprocess
import sys
import tempfile

ROOT = pathlib.Path(__file__).resolve().parents[2]
RECORD = pathlib.Path(__file__).resolve().with_name('kept_591f031.json')


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


def main():
    if len(sys.argv) != 2 or sys.argv[1] not in ('rust', 'js'):
        print('usage: tests_kept.py rust|js', file=sys.stderr)
        return 2
    suite = sys.argv[1]
    recorded = json.loads(RECORD.read_text())[suite]
    if suite == 'rust':
        missing = unmatched_rust(recorded, rust_results())
    else:
        results = js_results()
        missing = [name for name in recorded if not results.get(name, False)]
    for name in missing:
        print(f'missing or not passing: {name}')
    print(f'{suite}: {len(recorded) - len(missing)} of {len(recorded)} recorded tests pass')
    return 1 if missing else 0


if __name__ == '__main__':
    sys.exit(main())
