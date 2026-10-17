# 旅途彩虹桥 概念 + 实现方案（场景设计部 2026-10-17）
主图：rainbow_bridge_day_720x1280.png / rainbow_bridge_night_720x1280.png（游戏跟随镜头 back 6.6 / right 2.4 / up 3.4 / FOV 48）
两端：rainbow_bridge_ends_closeup.jpg　对比：rainbow_bridge_current_vs_new.jpg　自检：qa/rainbow_bridge_closeup_QA.jpg
天空之城方案 B：skycity-B/skycity_B_board_camera_verify.jpg + IMPLEMENTATION.md §8
实现：IMPLEMENTATION.md、engine-draft/、export/（GLB 样例）。复现：scripts/gate_run.sh full all 24；node scripts/sky_b.cjs 75 30 full 16（需 QF_TYPESCRIPT_MODULE=/workspace/tools/gltfpack/node_modules/typescript）
