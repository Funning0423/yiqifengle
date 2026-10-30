# Every >12 m span (lens > 12 m from her chest), skycity walks, 7 screens

Source: tools/region-nodes/test_sky_walk_whole.cjs --spans (per-screen rows in far12-spans.json). Start = seconds from the start of the sequence (board entry); ranges are across the 7 screens; hidden = chest (1.05 m) / face (1.45 m) sight line blocked by the mesh (all but clouds), counted at 60 Hz.
Gate: occlusion is NOT counted on board joins (in/out) beyond 12 m (approved rule); it IS counted on walk-plan skip joins at any distance (<=0.5 s). Every >12 m frame set must keep her in frame on >=95% of frames (T6).

| walk | case | part | screens | start s | duration s | max chest-hidden frames (one screen) | max face-hidden frames (one screen) | out-of-frame frames / frames (7 screens) |
|---|---|---|---|---|---|---|---|---|
| S1>S2 | board entry → exit | in | 7 | 0.00 | 1.63–3.65 | 0 | 0 | 0 / 1173 |
| S1>S2 | board entry → exit | skip | 7 | 6.78–9.35 | 0.83 | 10 | 0 | 0 / 350 |
| S1>S2 | board entry → exit | out | 7 | 12.58–15.67 | 4.33–6.38 | 0 | 0 | 0 / 2314 |
| S2>S3 | board entry → exit | in | 7 | 0.00 | 4.38–6.43 | 0 | 0 | 0 / 2339 |
| S2>S3 | board entry → exit | skip | 7 | 10.48–13.05 | 1.10 | 0 | 0 | 0 / 462 |
| S2>S3 | board entry → exit | out | 7 | 16.88–19.95 | 5.42–7.48 | 154 | 141 | 137 / 2776 |
| S3>S4 | board entry → exit | in | 7 | 0.00 | 5.38–7.43 | 155 | 142 | 134 / 2759 |
| S3>S4 | board entry → exit | out | 7 | 19.10–22.12 | 8.28–10.40 | 0 | 306 | 128 / 3994 |
| S4>S5 | board entry → exit | in | 7 | 0.00 | 8.17–10.32 | 0 | 315 | 125 / 3950 |
| S4>S5 | board entry → exit | skip | 7 | 14.23–16.80 | 1.23 | 0 | 0 | 0 / 518 |
| S4>S5 | board entry → exit | out | 7 | 22.22–25.18 | 11.15–13.32 | 306 | 306 | 136 / 5207 |
| S4>S6 | board entry → exit | in | 7 | 0.00 | 8.18–10.33 | 0 | 311 | 125 / 3959 |
| S4>S6 | board entry → exit | skip | 7 | 14.15–16.72 | 2.02 | 0 | 2 | 0 / 847 |
| S4>S6 | from S6 (planSkip) | in | 7 | 0.00 | 8.18–10.33 | 0 | 311 | 125 / 3959 |
| S4>S6 | from S6 (planSkip) | skip | 7 | 11.35–13.92 | 1.08 | 29 | 24 | 0 / 455 |
