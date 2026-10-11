#!/bin/bash
# Re-creates the engine-method evidence used by test_audio_context_contract.cjs and test_audio_ui_gestures.cjs:
# four unedited Cocos Creator engine v3.8.8 sources from github.com/cocos/cocos-engine (tag v3.8.8).
# usage: tools/fetch_audio_ui_upstream.sh [dest]   (default evidence/audio-ui-capture; not committed)
# then:  QF_AUDIO_UI_EVIDENCE=<dest> node tools/test_audio_ui_gestures.cjs   (Node >= 22.13 strips natively; older Node uses typescript)
set -euo pipefail
DEST=${1:-evidence/audio-ui-capture}; B=https://raw.githubusercontent.com/cocos/cocos-engine/v3.8.8
mkdir -p "$DEST/upstream-v3.8.8/audio"
while read -r src dst; do
  curl -sfL -o "$DEST/upstream-v3.8.8/$dst" "$B/$src"
done <<LIST
pal/audio/web/player-web.ts audio/player-web.ts
cocos/input/input.ts input.ts
cocos/scene-graph/node-event-processor.ts node-event-processor.ts
cocos/2d/event/pointer-event-dispatcher.ts pointer-event-dispatcher.ts
LIST
(cd "$DEST/upstream-v3.8.8" && sha256sum audio/player-web.ts input.ts node-event-processor.ts pointer-event-dispatcher.ts)
