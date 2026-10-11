# Compact UI contrast correction

Independent branch cocos/ui-contrast-20261009 from 55b92b837977e14fce1e453b937e60873ac744fc. No experimental R1/R2 GLB is included.

Added an opaque 172x114 dark badge and light border behind the result checkmark/score. Return icon uses opaque dark circular backing with light outline in both orientations. No large panel or layout expansion. Result return button behavior is unchanged.

Official Cocos Creator 3.8.8 build exit 36. Existing three-viewport touch regression passed (402x874 DPR3, 874x402, 1280x800 resized to 640x600), all with 8 actions, 910 score, 4 moves remaining, pause/return/recovery/result reload; zero runtime errors. Visually inspected result and landscape screenshots. Base GLB, scene and R4 compatibility source byte comparisons passed unchanged. Physical iPhone, Safari, FPS/thermal and persistent user-save acceptance remain untested.
