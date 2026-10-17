#!/bin/bash
cd /workspace/wechat-game/product/2026-10-16/gameplay-integration-concepts/scripts
while pgrep -f "chain4.sh|run3.sh" >/dev/null; do sleep 10; done
./run3.sh E_sky_kite
