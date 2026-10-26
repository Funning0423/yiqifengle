# sail-voyage (运镜bot, 2026-10-26) — NOT_ENGINE, CPU z-buffer of real env_meadow.glb + sailboat.glb + opaque sea at y −0.91
Current sail clock (sailBeats, route 37.16 m, v 3.6 m/s cap): S-a walk 7.6 · S-b board 2.0 · S-c unfurl/accel 2.0 · S-d cruise 8.22 ·
S-e dock/decel 2.2 · S-f 1.0 · S-g 0.8 = 23.82 s (whole island→meadow 41.4 s per 场景设计部). Chord I6→M0 52 m.
SailVoyage.ts: lens keyed to route progress p, in the boat→destination (sailM0World) bearing frame:
 departure p<0.06 = K1 · swing p0.06–0.30 · open sea p0.30–0.70 (port bow, low, looking across her) · swing 0.70–0.90 · approach ≥0.90 (port quarter on the destination line).
 voyageBeats(): +3.6 s S-d cruise (45 − 41.4), hull 2.67 m/s (slower, never faster). OFF by default (SAIL_VOYAGE.enabled=false).
Enabling needs: Grok Bot approval (re-baselines sail-farsea/k2k7 gold stills) and one adapter line (tl=voyageBeats) — adapter untouched here.
Test: test_sail_voyage.cjs, REPORT_ONLY; scenarios dz (farther island), occluder, scale stand-in. Plot: reports/sail-voyage-before-after.png.
