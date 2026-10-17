#!/bin/bash
cd /workspace/wechat-game/product/2026-10-16/gameplay-integration-concepts/scripts
while pgrep -f "run2.sh A_rail_crates B_snow" >/dev/null; do sleep 15; done
./run2.sh A_rail_crates B_snow_starmap C_cloud_terrace
