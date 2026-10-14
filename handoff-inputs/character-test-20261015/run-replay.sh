#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
sha256sum -c SHA256SUMS.txt
node --experimental-transform-types posture-work/early-release105/replay-roundtrip.mjs "$PWD/candidate/candidate.glb" "$PWD/candidate/anim_meta.json" "$PWD/seat-calibration.json" > candidate/replay.json
python3 verify_loaded.py
