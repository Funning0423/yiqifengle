#!/bin/bash
cd /workspace/wechat-game/product/2026-10-16/gameplay-integration-concepts/scripts
while pgrep -f "run3.sh D_hill" >/dev/null; do sleep 10; done
./run3.sh D_hill_picnic
