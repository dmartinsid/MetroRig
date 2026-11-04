"""Exits 0 only if the golden test was committed before any commit that adds or changes engine code.

Usage: python3 -I tests/fixtures/golden_first.py

The golden commit is the one that added src/golden_tests.rs. Every commit that adds or modifies a
file under engine/src other than golden_tests.rs must descend from it and be another commit.
Renames count as adds, so the move of the crate into engine/ is checked too.
"""
import pathlib
import subprocess
import sys

ROOT = pathlib.Path(__file__).resolve().parents[2]


def git(*args):
    return subprocess.run(['git', *args], cwd=ROOT, capture_output=True, text=True)


def main():
    added = git('log', '--no-renames', '--diff-filter=A', '--format=%H', '--', 'src/golden_tests.rs').stdout.split()
    if not added:
        print('no commit adds src/golden_tests.rs')
        return 1
    golden = added[-1]

    log = git('log', '--no-renames', '--diff-filter=AM', '--name-status', '--format=commit %H', '--', 'engine/src').stdout
    engine_commits = []
    commit = None
    for line in log.splitlines():
        if line.startswith('commit '):
            commit = line.split()[1]
        elif line.strip():
            path = line.split('\t')[-1]
            if pathlib.PurePosixPath(path).name != 'golden_tests.rs' and commit not in engine_commits:
                engine_commits.append(commit)

    late = [c for c in engine_commits
            if c == golden or git('merge-base', '--is-ancestor', golden, c).returncode != 0]
    for c in late:
        print(f'{c[:7]} changes engine code but does not follow the golden commit {golden[:7]}')
    print(f'golden commit {golden[:7]}; {len(engine_commits) - len(late)} of {len(engine_commits)} engine commits follow it')
    return 1 if late else 0


if __name__ == '__main__':
    sys.exit(main())
