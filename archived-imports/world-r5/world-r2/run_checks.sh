#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
python3 tools/generate_patch.py
node tools/check_syntax.cjs
node --test tests/native-integration.test.cjs 2>&1 | tee evidence/node-tests.txt
python3 tools/verify_and_manifest.py
