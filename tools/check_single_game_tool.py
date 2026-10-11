#!/usr/bin/env python3
"""Read-only process gate. Never launches, closes, activates, or signals an app."""
import argparse
import datetime
import json
from pathlib import Path
import subprocess


def inspect():
    roots, pending = [], []
    rows = subprocess.check_output(['ps', '-axo', 'pid=,ppid=,comm='], text=True)
    for line in rows.splitlines():
        parts = line.strip().split(None, 2)
        if len(parts) != 3:
            continue
        pid, parent, executable = int(parts[0]), int(parts[1]), parts[2]
        # Compare executable paths, not shell command text containing this script.
        creator = executable.endswith('/CocosCreator.app/Contents/MacOS/CocosCreator')
        wechat = executable == '/Applications/wechatwebdevtools.app/Contents/MacOS/Electron'
        if creator or wechat:
            roots.append({'pid': pid, 'parent': parent, 'kind': 'cocos' if creator else 'wechat', 'executable': executable})
        if executable.endswith('/wechatide') or executable.startswith('/tmp/oi-observe') or executable.startswith('/tmp/oi-controlled-reopen'):
            try:
                command = subprocess.check_output(['ps', '-p', str(pid), '-o', 'command='], text=True).strip()
            except subprocess.CalledProcessError:
                continue
            if 'open_project_window' in command or executable.startswith('/tmp/oi-observe') or executable.startswith('/tmp/oi-controlled-reopen'):
                pending.append({'pid': pid, 'executable': executable})
    return roots, pending


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--require', choices=['empty', 'wechat-only', 'cocos-only'], required=True)
    parser.add_argument('--expected-pid', type=int)
    parser.add_argument('--output', type=Path)
    args = parser.parse_args()
    roots, pending = inspect()
    expected_kind = args.require.replace('-only', '')
    allowed = not pending and (
        len(roots) == 0 if args.require == 'empty' else
        len(roots) == 1 and roots[0]['kind'] == expected_kind
    )
    if args.expected_pid is not None:
        allowed = allowed and len(roots) == 1 and roots[0]['pid'] == args.expected_pid
    report = {'utc': datetime.datetime.now(datetime.timezone.utc).isoformat(),
              'status': 'PASS' if allowed else 'BLOCKED', 'requirement': args.require,
              'roots': roots, 'pendingOpenOrBuild': pending,
              'readOnly': True, 'limitation': 'Instantaneous gate; does not reserve other authors\' tools or guarantee future absence. Check again immediately before launch.'}
    if args.output:
        if args.output.exists():
            raise SystemExit('Refusing to overwrite an earlier gate receipt')
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(json.dumps(report, indent=2) + '\n')
    print(json.dumps(report, indent=2))
    return 0 if allowed else 3


if __name__ == '__main__':
    raise SystemExit(main())
