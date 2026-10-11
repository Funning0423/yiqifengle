#!/usr/bin/env bash
# 干净检出后一次性准备：锁定 Node + npm ci（严格按 package-lock.json）。
set -euo pipefail
D=$(cd "$(dirname "$0")" && pwd); NODE=$("$D/fetch-node.sh" | tail -1); NB=$(dirname "$NODE")
(cd "$D" && PATH="$NB:$PATH" "$NB/npm" ci --no-audit --no-fund)
echo "NODE=$NODE"
