# Mobile native board UI - 2026-10-09

Base: 1d2d0d1e29845a0f42df6eb405d1c2a43afc9c9a. Isolated branch cocos/mobile-native-board-layout-20261009.

Removed the large cream panel. Native Canvas/Graphics/Sprite/Label now supplies compact icon goals and moves, centered board, bottom tools and pause. The original project piece atlas was copied unchanged (960x640; SHA256 0d9d66b936ed15d5d4c993686e51922e7e768dfcf28e5dd9b1795cd9f45d982e). This is reused project art, not newly commissioned final art or an independent rights certification. Provenance is recorded in evidence/pieces-atlas-reuse.json.

Portrait runtime background camera framing leaves sky/clouds and existing gull geometry visible. No world-r1 merge, scene/GLB edits, character transforms, gameplay rule changes or user-save writes. Controller remains the owner of movement. Existing 30 protected source/asset files and 1041 legacy files passed unchanged checks.

Official Cocos Creator 3.8.8 Web build completed with SUCCESS (exit 36). Chromium touch emulation passed 402x874 at DPR 3, 874x402, and 1280x800 resized during play to 640x600. Each case completed 8 touch swaps, score 910 with 4 moves remaining, pause/resume, return/resume, synthetic hide/show recovery, result reload and return. Runtime report has zero errors. Root render-window resizing fixes stale camera dimensions after browser resize; sprite CUSTOM sizing preserves cell dimensions after atlas loading.

Safe insets use CSS env values with conservative margins. This is CSS viewport/touch emulation, not physical iPhone/Safari acceptance, real persistent-storage acceptance, mobile FPS or thermal validation. Tools remain disabled prototype controls. Existing gull geometry is visible; new flight animation is not claimed.

Final evidence: evidence/mobile-ui-runtime.json, evidence/mobile-ui-boundary-check.json, evidence/creator-mobile-ui-final-build.log and four output/mobile-ui PNGs. Earlier WIP uploads 10Ca9vlbNWs6WB01n4qTbS38ygyOMczfu and 1apwAcMuJeR0kx_H6rKXU7xJa41_m5Oyc are superseded and must not be used as this candidate.

The smoothing repair package is queued separately for same-camera asset A/B in an isolated copy. It is not integrated into this UI revision.
