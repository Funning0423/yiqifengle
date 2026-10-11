#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
mkdir -p evidence
node tools/check_syntax.cjs
node --test tests/*.test.cjs 2>&1 | tee evidence/node-tests.txt
node tools/audit_geometry.cjs | tee evidence/door-audit.txt
python3 tools/audit_static_proxies.py | tee evidence/static-proxy-audit.txt
python3 tools/verify_sources.py
python3 tools/build_manifest.py
