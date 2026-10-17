#!/bin/bash
cd /workspace/wechat-game/art/regions/lakeside/ENGINE_COLOR_REFERENCE
while pgrep -f run_inspect.sh >/dev/null; do sleep 20; done
grep -q '"objects"' work/inspect_r5h3.json 2>/dev/null && python3 work/fmt_inspect.py > work/after_inspect.out 2>&1 && sed -i '/^> 2.4「Blender 实读」待补/d' REFERENCE.md
