# Scene audio V2 build scripts (Voice bot)

Sources live on the box in /workspace/v2amb/src (OpenGameArt CC0 downloads; sha256 in SOURCES-SHA256SUMS). Outputs go to out/ and wav/ in the working dir.
Order: s_island.py, s_meadow_birds.py, s_batch1.py (insects, sea), s_shots.py (birds, windmill), s_sky.py, then seamcheck.py <names>.
Previews: p_all.py (mix.py helpers) -> /workspace/yiqifengle/previews/Voice-bot/v2-scene-audio/, then clickscan.py.
measurements.json = per-file loop facts, bytes, ebur128 I / true peak, seam stats. Needs numpy, scipy, ffmpeg with libmp3lame.
