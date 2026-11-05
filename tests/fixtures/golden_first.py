"""Exits 0 only if the golden test passed on 591f031's engine and was committed before any commit that
adds or changes engine code.

Usage: python3 -I tests/fixtures/golden_first.py

The golden commit is the one that added src/golden_tests.rs. Its engine code must be 591f031's, the
only change being the `#[cfg(test)] mod golden_tests;` that declares the test, and its golden tests
must pass on a `git archive` of it. Every commit that adds, changes or deletes engine code must
descend from it and be another commit: under engine/src, and under src/*.rs since 591f031, where
the engine lived before the move. Renames count as adds and deletes, so the move into engine/ is
checked too. golden_tests.rs itself is not engine code.
"""
import pathlib
import re
import subprocess
import sys
import tarfile
import tempfile

ROOT = pathlib.Path(__file__).resolve().parents[2]
BASE = '591f031'
DECLARATION = ['+#[cfg(test)]', '+mod golden_tests;']


def git(*args):
    return subprocess.run(['git', *args], cwd=ROOT, capture_output=True, text=True)


def touching(revisions, pathspec):
    """The commits of `revisions` that add, change or delete a file of `pathspec` other than golden_tests.rs."""
    log = git('log', '--no-renames', '--diff-filter=AMD', '--name-status', '--format=commit %H',
              *revisions, '--', pathspec).stdout
    commits = []
    commit = None
    for line in log.splitlines():
        if line.startswith('commit '):
            commit = line.split()[1]
        elif line.strip():
            path = line.split('\t')[-1]
            if pathlib.PurePosixPath(path).name != 'golden_tests.rs' and commit not in commits:
                commits.append(commit)
    return commits


def engine_changes_of_golden(golden):
    """Lines the golden commit changed in 591f031's engine code, besides the test's declaration."""
    diff = git('diff', '-U0', BASE, golden, '--', 'src/*.rs', ':!src/golden_tests.rs').stdout
    changed = [line for line in diff.splitlines()
               if line[:1] in '+-' and not line.startswith(('+++', '---'))]
    return changed if changed != DECLARATION else []


def golden_tests_pass(golden):
    """Runs `cargo test golden_tests` on an archive of the golden commit; returns (passed, failed, expected)."""
    expected = len(re.findall(r'#\[test\]', git('show', f'{golden}:src/golden_tests.rs').stdout))
    with tempfile.TemporaryDirectory() as folder:
        archive = pathlib.Path(folder) / 'golden.tar'
        subprocess.run(['git', 'archive', '--format=tar', f'--output={archive}', golden], cwd=ROOT, check=True)
        tree = pathlib.Path(folder) / 'tree'
        with tarfile.open(archive) as tar:
            tar.extractall(tree, filter='data')
        run = subprocess.run(['cargo', 'test', 'golden_tests'], cwd=tree, capture_output=True, text=True)
    results = re.findall(r'^test (golden_tests::\S+) \.\.\. (\w+)', run.stdout, re.M)
    passed = [name for name, status in results if status == 'ok']
    failed = [name for name, status in results if status != 'ok']
    if run.returncode != 0 and not failed:
        failed = ['cargo test exited with an error']
        print(run.stderr[-2000:])
    return passed, failed, expected


def main():
    added = git('log', '--no-renames', '--diff-filter=A', '--format=%H', '--', 'src/golden_tests.rs').stdout.split()
    if not added:
        print('no commit adds src/golden_tests.rs')
        return 1
    golden = added[-1]
    ok = True

    extra = engine_changes_of_golden(golden)
    for line in extra:
        print(f'golden commit {golden[:7]} changes engine code of {BASE}: {line}')
    ok &= not extra

    passed, failed, expected = golden_tests_pass(golden)
    for name in failed:
        print(f'golden test fails at {golden[:7]}: {name}')
    print(f'golden commit {golden[:7]}: {len(passed)} of {expected} golden tests pass on its archive')
    ok &= not failed and len(passed) == expected > 0

    engine_commits = touching([], 'engine/src')
    engine_commits += [c for c in touching([f'{BASE}..HEAD'], 'src/*.rs')
                       if c not in engine_commits and not (c == golden and not extra)]
    late = [c for c in engine_commits
            if c == golden or git('merge-base', '--is-ancestor', golden, c).returncode != 0]
    for c in late:
        print(f'{c[:7]} changes engine code but does not follow the golden commit {golden[:7]}')
    print(f'golden commit {golden[:7]}; {len(engine_commits) - len(late)} of {len(engine_commits)} engine commits follow it')
    ok &= not late
    return 0 if ok else 1


if __name__ == '__main__':
    sys.exit(main())
