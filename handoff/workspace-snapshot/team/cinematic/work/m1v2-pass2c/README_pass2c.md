# M1 v2 × pass2c interim integration (运镜bot, 2026-10-09 22:00 CT)
Run: ./run_all.sh p2c2 (build → anim → anchors → check), then probe/package_p2c2.sh
- Scene: scene/cine_m1_anim.blend (4w, BONE_DEFORM limit = no-op); scene/cine_m1_anim_origw.blend (original weights)
- Clipping per frame: probe/check_p2c2.json, probe/check_p2c2_origw.json; range tables: probe/range_table_p2c2_{4w,origw}.txt
- Bone diff vs v2g: probe/bonediff_p2c2_vs_v2g.json. Rest check: probe/rest_check_{4w,origw}.json
- Repro of grokbot2's check (copy, theirs/): probe/theirchk_repro_kfix0.json (as delivered) / kfix1.json (bone scale fixed)
- GLB: export/clips/cine_m1_open_stand_turn.glb (+ export/timing/*.timing.json, export/report/glb_probe_p2c2.json, contact_report_p2c2.json, probe/verify_our_export_glb.json)
- f30–32 export: ../../outbox/20261009T2200-cinematic-m1-pass2c-f30-32/
VERDICT (bow tail excluded in stand f34–54/f74–81): FAIL. Root cause: on the model side the fit used 1/K bone scaling (see outbox README).
