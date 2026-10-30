#!/usr/bin/env node
'use strict';
// No browser/editor launch. Process completion is reported separately from visual acceptance.
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process'),crypto=require('node:crypto');
const ROOT=path.resolve(__dirname,'../..'),out=path.join(__dirname,'reports');fs.mkdirSync(out,{recursive:true});
const tests=[
 ['meta-allowlist','tools/build-guard/meta-allowlist.cjs'],['manifest-files-exist','tools/build-guard/manifest-files-exist.cjs'],['meta-gates-selftest','tools/build-guard/test_meta_gates.cjs'],['sha-pin-coverage','tools/build-guard/sha-pin-coverage.cjs'],['sha-pin-coverage-selftest','tools/build-guard/test_sha_pin_coverage.cjs'],['meadow-encode-ext','tools/creator-ext/test_meadow_encode_ext.cjs'],['meta-import-ext','tools/creator-ext/test_meta_import_ext.cjs'],/* run first: per-field .meta allowlist vs merge-base with ggbot/full9c-final, manifest entries exist */
 ['skycity-continue-tap','tools/journey-integration/test-skycity-continue-tap.cjs'],
 ['b1-start-budget','tools/transitions-continuous/test_b1_start_budget.cjs'],
 ['entry-pause-panel','tools/board-ui/test_entry_pause_panel.cjs'],
 ['warm-button-bake-retry','tools/board-ui/test_warm_button_bake_retry.cjs'],
 ['meadow-walk-no-uturn','tools/meadow-walk/test_meadow_walk_no_uturn.cjs'],
  ['sky-resume-s6','tools/skycity-walk/test_sky_resume_s6.cjs'],
  ['sky-s2s3-edge-clearance','tools/skycity-walk/test_sky_s2s3_edge_clearance.cjs'],
  ['sky-lake-prewalk','tools/skycity-walk/test_sky_lake_prewalk.cjs'],
  ['full6-lake-fixes','tools/full6-lake/test_full6_lake_fixes.cjs'],
 ['meadow-walk-colliders','tools/meadow-walk/test_meadow_walk_colliders.cjs'],/* M6 moved to (0.2,6.49,-24.8) by 场景设计部: 1.003 m */
 ['meadow-walk-sweep','tools/meadow-walk/test_meadow_walk_sweep.cjs'],
 ['one-ccclass-per-file','tools/journey-integration/test-one-ccclass-per-file.cjs'],
 ['production-integrity','tools/journey-integration/test-production-integrity.cjs'],['frozen-inputs-pins','tools/journey-integration/test-frozen-inputs-pins.cjs'],
 ['journey-types','tools/journey-integration/test-journey-types.cjs'],
 ['independent-mainline','tools/journey-integration/test-mainline-boundaries.cjs'],
 ['independent-journey','tools/journey-integration/test-journey-lifecycle.cjs'],
 ['journey-cutscene-ui','tools/journey-integration/test-journey-cutscene-ui.cjs'],
 ['journey-background-audio','tools/journey-integration/test-journey-background-audio.cjs'],
 ['composition-boundaries','tools/journey-integration/test-composition-boundaries.cjs'],
 ['world-region-exit','tools/journey-integration/test-world-region-exit.cjs'],
 ['region-levels','tools/region-levels/test-region-levels.cjs'],
 ['production-binding','tools/region-levels/test-production-binding.cjs'],
 ['region-journey-flow','tools/test_region_journey.cjs'],
 ['region-journey-host','tools/test_region_journey_host.cjs'],
 ['region-entry','tools/board-ui/test_region_flow_entry.cjs'],
 ['region-failure','tools/board-ui/test_region_flow_failure.cjs'],
 ['region-ui','tools/board-ui/test_region_flow_ui.cjs'],
 ['region-reentry','tools/board-ui/test_region_flow_reentry.cjs'],
 ['region-ports','tools/board-ui/test_region_flow_ports.cjs'],
 ['chapter-gates','tools/board-ui/test_chapter_gates.cjs'],
 ['legacy-action-clock','tools/test_character_action_clock.cjs'],
 ['legacy-board-ui-pure','tools/board-ui/test_board_ui_pure.cjs'],
 ['legacy-startup-ready','tools/test_startup_ready_gate.cjs'],
 ['chapter-production-entry','tools/legacy-test-repair/test-chapter-production-entry.cjs'],
 ['controller-integrity-guard','tools/legacy-test-repair/test-controller-integrity.cjs'],
 ['character-real-glb-endpoints','tools/legacy-test-repair/test-character-endpoints-real-glb.cjs'],
 ['input-ownership','tools/board-ui/test_input_ownership.cjs'],
 ['board-runtime','tools/board-ui/test_board_runtime.cjs'],
 ['board-freeze-recovery','tools/board-ui/test_board_freeze_recovery.cjs'],
 ['board-storage-recovery','tools/board-ui/test_board_storage_recovery.cjs'],
 ['reward-background-return','tools/board-ui/test_reward_background_return.cjs'],
 ['restored-entry-resume','tools/board-ui/test_restored_entry_resume.cjs'],
 ['lakeside-landing-no-pause','tools/board-ui/test_lakeside_landing_no_pause.cjs'],
 ['lakeside-pathv4','tools/lakeside-pathv4/metrics.cjs'],
 ['lakeside-landing-board-progress','tools/journey-integration/test-lakeside-landing-board-progress.cjs'],
 ['route-occlusion','tools/journey-integration/test-route-occlusion.cjs'],['route-framing','tools/journey-integration/test-route-framing.cjs'],['route-continuity','tools/journey-integration/test-route-continuity.cjs'],
 ['result-retry','tools/board-ui/test_result_retry.cjs'],
 ['board-art-retry','tools/board-ui/test_board_art_retry.cjs'],
 ['deferred-entry-art','tools/board-ui/test_deferred_entry_art.cjs'],
 ['child-first-teardown','tools/board-ui/test_child_first_teardown.cjs'],
 ['result-claim-batch','tools/board-ui/test_claim_batch.cjs'],
 ['result-screen-style','tools/board-ui/test_result_screen_style.cjs'],['lose-caption-fit','tools/board-ui/test_lose_caption_fit.cjs'],
 ['board-hint-above-tray','tools/board-ui/test_board_hint_above_tray.cjs'],
 ['navigation-guard','tools/test_world_navigation_guard.cjs'],
 ['retry-protection','tools/test_retry_protection.cjs'],
 ['cloud-web-contract','tools/cloud-web/test.cjs'],
 ['exit-cine-audio','tools/test_exit_cine_audio.cjs'],
 ['exit-footsteps','tools/exit-footsteps/test_footsteps.cjs'],
 ['cconb-bin-only','tools/test_cconb_bin_only.cjs'],
 ['fade-cover-alpha','tools/test_fade_cover_alpha.cjs'],
 ['windwipe-ending','tools/windwipe/test_windwipe.cjs'],
 ['region-arrival-title','tools/region-title/test_region_title.cjs'],
 ['t03-arrival','tools/t03/test_t03_arrival.cjs'],
 ['result-chest-handoff','tools/board-ui/test_result_chest_handoff.cjs'],
 ['result-float-lift','tools/board-ui/test_result_float_lift.cjs'],
 ['meadow-night-sky','tools/test_meadow_night_sky.cjs'],
 ['wind-audio','tools/voice-bot/wind/test_wind_audio.cjs'],
 ['scene-audio-transitions','tools/voice-bot/bgm/test_scene_audio_transitions.cjs'],
 ['scene-bgm-switch','tests/test_scene_bgm_switch.cjs'],
 ['wx-autoplay-harness','tools/wx-autoplay/test-wx-autoplay.cjs'],
 ['update-prompt','tools/first-screen/test_update_prompt.cjs'],
 ['placeholder-gate','tools/build-guard/check-no-placeholder.cjs'],
 ['system-panels','tools/system-panels/test_system_panels.cjs'],
 ['first-screen-minified-parity','tools/first-screen/test_minified_parity.cjs'],
 ['advisory-boot-timing','tools/first-screen/test_advisory_boot_timing.cjs'],
 ['press-state','tools/system-panels/test_press_state.cjs'],
 ['ui-timing-registry','tools/ui-timing/test_ui_timing_registry.cjs'],
 ['landmark-audio','tests/test_landmark_audio.cjs'],
 ['meadow-night-grade','tools/test_meadow_night_grade.cjs'],
 ['region-board-staging','tools/meadow/test_region_board_staging.cjs'],/* r5 G1: meadow / sky-city board work spread over level-loading */
 ['exit-background-resume','tools/journey-integration/test-exit-background-resume.cjs'],
 ['world-background-freeze','tools/journey-integration/test-world-background-freeze.cjs'],
 ['glass-sign-layout','tools/test_glass_sign_layout.cjs'],
 ['glass-sign-night','tools/test_glass_sign_night.cjs'],
 ['exit-restart-quiet','tools/test_exit_restart_quiet.cjs'],
 ['home-sea-fadein','tools/test_home_sea_fadein.cjs'],
 ['build-guard-selftest','tools/build-guard/test_build_guard.cjs'],['glb-skin-bounds','tools/glb-skin/test_glb_skin_bounds.cjs'],
 ['release-probe-strip-gates','tools/build-guard/test_release_gates.cjs'],
 ['preload-bytes','tools/preload-size/test_preload_bytes.cjs'],['preload-source-pins','tools/preload-size/preload-source-pins.cjs'],['preload-source-pins-selftest','tools/preload-size/test_preload_source_pins.cjs'],['reveal-camera-motion','tools/journey-integration/test-reveal-camera-motion.cjs'],['enter-level-single-writer','tools/journey-integration/test-enter-level-single-writer.cjs'],
 ['lakeside-rules','tools/lakeside/test_lakeside_rules.cjs'],['lakeside-entry','tools/lakeside/test_lakeside_entry.cjs'],['new-regions','tools/new-regions/test_new_regions.cjs'],['journey-layout-r4','tools/new-regions/test_journey_layout_r4.cjs'],['dev-wording','tools/build-guard/dev-wording.cjs'],['dev-wording-selftest','tools/build-guard/test_dev_wording.cjs'],['lakeside-retune-b18','tools/lakeside/test_lakeside_retune_b18.cjs'],['lakeside-stale-board-b18','tools/lakeside/test_lakeside_stale_board_b18.cjs'],['lakeside-stale-notice-ui-b18','tools/lakeside/test_lakeside_stale_notice_ui_b18.cjs'],['lakeside-landing-walk-interrupt','tools/lakeside/test_lakeside_landing_walk_interrupt.cjs'],
 ['lakeside-instancing','tools/lakeside/test_lakeside_instancing.cjs'],['lakeside-dirlight','tools/lakeside/test_lakeside_dirlight.cjs'],['lakeside-water-fog','tools/lakeside/test_lakeside_water_fog.cjs'],
 ['lakeside-meshopt','tools/lakeside/test_lakeside_meshopt.cjs'],
 ['es5-iterator-spread','tools/test_es5_iterator_spread.cjs'],
 ['lakeside-load-failure','tools/lakeside/test_lakeside_load_failure.cjs'],
 ['lakeside-prewarm','tools/lakeside/test_lakeside_prewarm.cjs'],
 ['lakeside-journey-atmosphere','tools/lakeside/test_lakeside_journey_atmosphere.cjs'],
 ['lakeside-fallback','tools/lakeside/test_lakeside_fallback.cjs'],
 ['lakeside-daynight','tools/lakeside/test_lakeside_daynight.cjs'],
 ['lakeside-sky-follow','tools/lakeside/test_lakeside_sky_follow.cjs'],
 ['lakeside-far-view','tools/lakeside/test_lakeside_far_view.cjs'],
 ['lakeside-shared-water','tools/lakeside/test_lakeside_shared_water.cjs'],['lakeside-sky-reflection','tools/lakeside/test_lakeside_sky_reflection.cjs'],['lakeside-land-fill','tools/lakeside/test_lakeside_land_fill.cjs'],['lakeside-journey-water-fallback','tools/lakeside/test_lakeside_journey_water_fallback.cjs'],['lakeside-journey-sun','tools/lakeside/test_lakeside_journey_sun.cjs'],['lakeside-journey-water-prewarm','tools/lakeside/test_lakeside_journey_water_prewarm.cjs'],
 ['lakeside-board-guest','tools/lakeside/test_lakeside_board_guest.cjs'],
 ['lakeside-board-preload','tools/lakeside/test_lakeside_board_preload.cjs'],['region-board-ambient','tools/lakeside/test_region_board_ambient.cjs'],
 ['lakeside-balloon-mooring','tools/lakeside/test_lakeside_balloon_mooring.cjs'],
 ['lakeside-reveal-orbit','tools/lakeside/test_lakeside_reveal_orbit.cjs'],
 ['lakeside-qashot','tools/lakeside/test_lakeside_qashot.cjs'],
 ['lakeside-life','tools/scene-fx/test_lakeside_life.cjs'],
 ['lakeside-walk-tail','tools/lakeside/test_walk_tail.cjs'],
 ['lakeside-home-fade-tail','tools/lakeside/test_home_fade_tail.cjs'],
 ['snowpass-grey','tools/scene-fx/test_snowpass_grey.cjs'],
 ['lakeside-camera','tools/journey-integration/test-lakeside-camera.cjs'],['lakeside-leg-hide','tools/journey-integration/test-lakeside-leg-hide.cjs'],['lakeside-journey-wire','tools/journey-integration/test-lakeside-journey-wire.cjs'],['lakeside-reach','tools/lakeside/test_lakeside_reach.cjs'],['lakeside-landing-hook','tools/journey-integration/test-lakeside-landing-hook.cjs'],['region-landing-hook','tools/journey-integration/test-region-landing-hook.cjs'],['board-handoff','tools/journey-integration/test-board-handoff.cjs'],['lake-leg-c','tools/transitions-continuous/test_lake_leg_c.cjs'],['basket-close','tools/transitions-continuous/test_basket_close.cjs'],['live-start','tools/transitions-continuous/test_live_start.cjs'],['t02-dock','tools/transitions-continuous/test_t02_dock.cjs'],['gangway-frame','tools/transitions-continuous/test_gangway_frame.cjs'],['cam-trace-log','tools/journey-integration/test-cam-trace-log.cjs'],['solid-frame','tools/transitions-continuous/test_solid_frame.cjs'],['meadow-prewalk-follow','tools/transitions-continuous/test_meadow_prewalk_follow.cjs'],['camera-collision','tools/transitions-continuous/test_camera_collision.cjs'],['collision-gate-m2-mustfail','tools/transitions-continuous/test_collision_gate_m2.cjs'],['collision-gate-sail-mustfail','tools/transitions-continuous/test_collision_gate_sail.cjs'],['flat-frames','tools/transitions-continuous/test_flat_frames.cjs'],['sky-resume-follow','tools/skycity-walk/test_sky_resume_follow.cjs'],['sky-resume-plans-fresh','tools/skycity-walk/test_sky_resume_plans_fresh.cjs'],['sky-resume-fallback-reuse','tools/skycity-walk/test_sky_resume_fallback_reuse.cjs']/* full9b option A: forced fallback, 6 starts + S0L × 8 offsets ≤ 0.75 m, 7 screens, real mesh, HARD */,['fence-gate','tools/transitions-continuous/test_fence_gate.cjs'],['lake-ambience','tools/test_lake_ambience.cjs'],
 ['cam-single-writer','tools/journey-integration/test-cam-single-writer.cjs'],['board-bg-single-write','tools/journey-integration/test-board-bg-single-write.cjs'],['balloon-first-frame','tools/journey-integration/test-balloon-first-frame.cjs'],['b1-yard-balloon','tools/journey-integration/test-b1-yard-balloon.cjs'],['probes','tools/journey-integration/test-probes.cjs'],['transition-totals','tools/journey-integration/test-transition-totals.cjs'],['cam-trace-bounded','tools/journey-integration/test-cam-trace-bounded.cjs'],['b1-gap-log','tools/journey-integration/test-b1-gap-log.cjs']/* full9b P0: camTrace ON re-entry guard, bounded lines/stacks, no promises *//* full9b P0: one camera writer per frame on the balloon legs (Mac MULTI=2/3) */,
 ['balloon-hold-writer','tools/journey-integration/test-balloon-hold-writer.cjs'],['sky-lake-walk-budget','tools/journey-integration/test-sky-lake-walk-budget.cjs'],['skycity-root-frame','tools/journey-integration/test-skycity-root-frame.cjs'],['p2-lakeside-gate','tools/journey-integration/test-p2-lakeside-gate.cjs'],['c-prewalk-clouds','tools/journey-integration/test-c-prewalk-clouds.cjs'],['c3-transition-chain-selftest','tools/journey-integration/test-c3-transition-chain.cjs'],/* fullN: clip19 prewalk-cloud-paint landed via 8c98bbfe */['walk-edge-length','tools/region-nodes/test_walk_edge_length.cjs'],
 ['sky-resume-begin','tools/skycity-walk/test_sky_resume_begin.cjs'],
 ['lakeside-static-merge','tools/lakeside/test_lakeside_static_merge.cjs'],['lakeside-pavilion','tools/lakeside/test_lakeside_pavilion.cjs'],['lakeside-light-encoding','tools/lakeside/test_lakeside_light_encoding.cjs'],['lakeside-olive','tools/lakeside/test_lakeside_olive.cjs'],['lakeside-diag','tools/lakeside/test_lakeside_diag.cjs'],
 ['lakeside-journey-merge','tools/lakeside/test_lakeside_journey_merge.cjs'],
 ['lakeside-merge-share','tools/lakeside/test_lakeside_merge_share.cjs'],
 ['rider-parenting','tools/transitions/test_rider_parenting.cjs'],
 ['transport-sail','tools/transitions/test_transport_sail.cjs'],
 ['sail-art','tools/transitions/test_sail_art.cjs'],
 ['cloud-sit-fix','tools/transitions/test_cloud_sit_fix.cjs'],/* fix-cloud-sit: cloud layer single writer during the sail, disembark stops engine states */
 ['sail-clearance','tools/transitions/test_sail_clearance.cjs'],
 ['sail-dock-path','tools/transitions/test_sail_dock_path.cjs'],
 ['sail-k2k7','tools/transitions/test_sail_k2k7.cjs'],
 ['sail-continuity','tools/transitions/test_sail_continuity.cjs'],
 ['sail-farsea','tools/transitions/test_sail_farsea.cjs'],['sail-sea-distance','tools/sea-distance/test_sail_sea_distance.cjs']/* full8 plan E */,['sea-assets','tools/sea-distance/test_sea_assets.cjs'],['standin-raster','tools/sea-distance/test_standin_raster.cjs'],
 ['meadow-windwipe','tools/sky-lake/test_meadow_windwipe.cjs'],['meadow-grass-preswap','tools/sky-lake/test_meadow_grass_preswap.cjs'],['sail-voyage','tools/sail-voyage/test_sail_voyage.cjs'],['debug-query','tools/debug-query/test_debug_query.cjs'],['city-night-restore','tools/skycity-night/test_city_night_restore.cjs'],['b1-lens-windmill','tools/b1-lens/test_b1_lens_windmill.cjs'],['m6-single-source','tools/b1-lens/test_m6_single_source.cjs'],['prewalk-lens-clear','tools/b1-lens/test_prewalk_lens_clear.cjs'],['world-yaw-flight-blend','tools/b1-lens/test_world_yaw_flight_blend.cjs'],['lake-continuity','tools/sky-lake/test_lake_continuity.cjs'],['skycity-windwipe','tools/sky-lake/test_skycity_windwipe.cjs'],/* full8: night silhouette undone at touchdown/release *//* full8: launch-query debug flags *//* hard gate (运镜bot plan E lens, 4012da49) */
 ['frame-background','tools/transitions/test_frame_background.cjs'],
 ['asset-budget','tools/transitions/asset-budget.cjs'],
 ['transport-flag','tools/transitions/test_transport_flag.cjs'],
 ['no-bridge-fallback','tools/transitions/test_no_bridge_fallback.cjs'],
 ['transit-background-resume','tools/transitions/test_transit_background.cjs'],
 ['region-nodes-data','tools/region-nodes/test_region_nodes_data.cjs'],
 ['region-nodes-progress','tools/region-nodes/test_region_nodes_progress.cjs'],['lakeside-order','tools/region-nodes/test_lakeside_order.cjs'],
 ['region-nodes-walk','tools/region-nodes/test_region_nodes_walk.cjs'],
 ['explore-camera','tools/region-nodes/test_explore_camera.cjs'],
 ['free-orbit','tools/region-nodes/test_free_orbit.cjs'],
 ['explore-drag-rotate','tools/region-nodes/test_explore_drag_rotate.cjs'],
 ['explore-arm','tools/region-nodes/test_explore_arm.cjs'],/* r17: first drag → arm floor/ceiling (real regionBounds), walk-end yaw, island yaw drift */
 ['explore-entry-follow','tools/region-nodes/test_explore_entry_follow.cjs'],/* p0drag5: lakeside explore entry follows her from frame 1 (background camera off) */
 ['bgcam-gate','tools/region-nodes/test_bgcam_gate.cjs'],/* p0drag6: walk cover / explore / warm-up all go through BgCamGate */
 ['p0drag7','tools/region-nodes/test_p0drag7.cjs'],/* skycity snap entry, arm hysteresis (Mac trace replay), skycity house proxies, camTrace in explore */
 ['p0drag8','tools/region-nodes/test_p0drag8.cjs'],/* skycity platform replay (2112 boxes + refresh churn), lakeside walk-drag pitch, island sign fallback, qfSkip-gated hooks */
 ['p0drag9','tools/region-nodes/test_p0drag9.cjs'],/* skycity ro-turn replay (eased avoidance, framing on 7 screens), teleport yaw convention, aimAt world point */
 ['p0drag10','tools/region-nodes/test_p0drag10.cjs'],/* REAL Mac skxd ro/pock trace replay (drag-event dt=0 writes, hook cuts): per-frame easing, no lens in a box, face+chest occlusion, hook hold, sign front, camTrace occ */
 ['p0drag11','tools/region-nodes/test_p0drag11.cjs'],/* Mac p0drag10 traces: Q0 occ calibration (≥97.5 % frames), Q1 4 slow turns face/chest ≤0.5 s, Q2 nook walk-end facing, Q3 sign from its text side, Q4 teleport ends the walk */
 ['p0drag12','tools/region-nodes/test_p0drag12.cjs'],/* Mac p0drag11 traces: W1 nook walks face/chest ≤0.5 s + no lens in a box while walking, L1 low-angle (12°/20°) replays of the slow turns, Y1 yaw-rate audit, S1 island sign shot: her + whole sign on 7 screens */
 ['p0drag13','tools/region-nodes/test_p0drag13.cjs'],['sail-blue-frame','tools/transitions-continuous/test_sail_blue_frame.cjs'],['balloon-spots','tools/transitions-continuous/test_balloon_spots.cjs'],['sky-walk-shot','tools/transitions-continuous/test_sky_walk_shot.cjs'],['transitions-continuous','tools/transitions-continuous/test_transitions_continuous.cjs'],['sky-finale-continue','tools/transitions-continuous/test_sky_finale_continue.cjs'],['sky-finale-frames','tools/transitions-continuous/test_sky_finale_frames.cjs'],['board-bg-fade','tools/transitions-continuous/test_board_bg_fade.cjs'],['gangway-switch','tools/dock-models/test_gangway_switch.cjs'],['sky-lake-continuous','tools/transitions-continuous/test_sky_lake_continuous.cjs'],['meadow-lift-clearance','tools/transitions-continuous/check-meadow-lift.cjs'],/* b19 meadow lift-off at the new basket point: wind_bell_frame + windmill blade sweep ≥0.5 m */['chain-ggbot','tools/transitions-continuous/test_chain_ggbot.cjs'],/* segment 6 skycity→lakeside without the boarding cover: C1→lift-off→T-03 12 s flight→C2→board, 7 screens *//* no-WindWipe handoff continuity (pos/yaw/FOV/accel caps) + 30 s meadow→skycity ride clock *//* Mac p0drag12 traces: O1 slow turns (hook-release rule, eased ≤90°/s ≤200°/s² standing), K1 pocket walks (tap-time plan ≤120°/s ≤300°/s², no lens in a box), R1 written-yaw cap */
 ['cam-trace','tools/region-nodes/test_cam_trace.cjs'],/* p0drag4b: ?camTrace=1 off = no writes, on = writer ids */
 ['skycity-stand','tools/region-nodes/test_skycity_stand.cjs'],/* p0d5sky: off-walkable explore open → nearest node; __qfTeleport */
 ['lakeside-entry-deck','tools/journey-integration/test-lakeside-entry-deck.cjs'],
 ['room-keepinside','tools/region-nodes/test_room_keepinside.cjs'],
 ['explore-input','tools/region-nodes/test_explore_input.cjs'],
 ['lakeside-walkable','tools/lakeside-walkable/test_lakeside_walkable.cjs'],['lakeside-seam-skirt','tools/lakeside/test_lakeside_seam_skirt.cjs'],
 ['meadow-board-framing','tools/meadow/test_meadow_board_framing.cjs'],
 ['node-board-pose','tools/region-nodes/test_node_board_pose.cjs'],
 ['region-transport-flag','tools/region-nodes/test_transport_flag.cjs'],
 ['region-transit-background-resume','tools/region-nodes/test_transit_background_resume.cjs'],
 ['region-nodes-scene-wiring','tools/region-nodes/test_region_scene_wiring.cjs'],
 ['node-markers','tools/region-nodes/test_region_scene_wiring.cjs'],
 ['node-markers-no-passed-flag','tools/region-nodes/test_node_markers_no_passed_flag.cjs'],
 ['explore-props','tools/region-nodes/test_region_scene_wiring.cjs'],
 ['advance-walk-timeout','tools/region-nodes/test_region_scene_wiring.cjs'],
 ['lens-clearance','tools/region-nodes/test_lens_clearance.cjs'],
  ['t02-sky-final','tools/region-nodes/test_t02_sky_final.cjs'],['finale-stand','tools/region-nodes/test_finale_stand.cjs'],['clip19-regressions','tools/journey-integration/test-clip19-regressions.cjs'],/* clip19: 19bd812a camera regressions R1–R4 */['sky-walk-endshots','tools/region-nodes/test_sky_walk_endshots.cjs'],['walk5a-in-frame','tools/skycity-walk/test_walk5a_in_frame.cjs'],['sky-finale-rail','tools/region-nodes/test_sky_finale_rail.cjs'],['sky-walk-whole','tools/region-nodes/test_sky_walk_whole.cjs'],['landing-move','tools/transitions-continuous/test_landing_move.cjs'],['lens-trajectory-clearance','tools/journey-integration/lens-clearance-gate.cjs'],['lens-trajectory-9ec-must-fail','tools/journey-integration/test-lens-clearance-9ec-must-fail.cjs'],/* clip3: whole-trajectory lens vs real meshes + balloon + her + ground */
 ['transport-balloon','tools/journey-integration/test-transport-balloon.cjs'],
 ['balloon-windsource-bound','tools/journey-integration/test-balloon-windsource-bound.cjs'],
  ['balloon-sun-continuity','tools/journey-integration/test-balloon-sun-continuity.cjs'],['lakeside-touchdown-timeline','tools/journey-integration/test-lakeside-touchdown-timeline.cjs'],['balloon-sky-dome-yaw','tools/journey-integration/test-balloon-sky-dome-yaw.cjs'],['balloon-light-handoff','tools/journey-integration/test-balloon-light-handoff.cjs'],['qa-skip','tools/journey-integration/test-qa-skip.cjs'],['pre-transition','tools/journey-integration/test-pre-transition.cjs'],['journey-prune','tools/journey-integration/test-journey-prune.cjs'],['island-exit-explore','tools/journey-integration/test-island-exit-explore.cjs'],['island-explore-touch','tools/journey-integration/test-island-explore-touch.cjs'],['lakeside-exit-explore','tools/journey-integration/test-lakeside-exit-explore.cjs'],
  ['balloon-night-sky-states','tools/journey-integration/test-balloon-night-sky-states.cjs'],
  ['mesh-quantize-float-color','tools/journey-integration/test-mesh-quantize-float-color.cjs'],
  ['sail-mesh-ready','tools/journey-integration/test-sail-mesh-ready.cjs'],
 ['balloon-transport-flag','tools/journey-integration/test-transport-flag.cjs'],
 ['balloon-transit-background-resume','tools/journey-integration/test-transit-background-resume.cjs'],
 ['sky-arrival','tools/transitions/test_sky_arrival.cjs'],
 ['sky-cloudsea','tools/transitions/test_sky_cloudsea.cjs'],
 ['skycity-face-budget','tools/skycity/test_skycity_face_budget.cjs'],
 ['skycity-visibility','tools/skycity/test_skycity_visibility.cjs'],/* b19: no repo camera sees through the face-budget holes (fast sampling; --full for every orbit lens) */
 ['skycity-night-grade','tools/skycity/test_skycity_night_grade.cjs'],['skycity-board-clear','tools/skycity/test_skycity_board_clear.cjs'],
 ['lakeside-sun-continuity','tools/lakeside/test_lakeside_sun_continuity.cjs'],/* r4.2 item 7 */
 ['board-prewarm-swap','tools/board-ui/test_board_prewarm_swap.cjs'],/* r4.2 items 10/11 */
 ['region-board-night','tools/meadow/test_region_board_night.cjs'],/* r4.2 item 9 */
 ['lakeside-quiet-logs','tools/lakeside/test_lakeside_quiet_logs.cjs'],/* r4.2 item 3 */
 ['lakeside-water-probe','tools/lakeside/test_lakeside_water_probe.cjs'],/* r4.2 item 4 */
 ['navigation-guard-timeout','tools/journey-integration/test-navigation-guard-timeout.cjs'],/* r4.2 item 20 */
 ['lakeside-first-show-staged','tools/lakeside/test_lakeside_first_show_staged.cjs'],/* r4.2 warning 6 */
 ['h5-mouse-bridge','tools/h5-mouse/test_h5_mouse_bridge.cjs'],/* b16 P2-1 H5 mouse */
 ['ui-b16-fixes','tools/ui-b16-fixes/test_b16_ui_fixes.cjs'],/* UI设计部 b16: P1 signpost, P2 sky-city night key light, L13 rule guide, r6 lakeside measure_visible gate */
 ['lakeside-lens-guard','tools/journey-integration/test-lakeside-lens-guard.cjs'],/* b17r13: supersedes lakeside-lens-occlusion (LensPullIn, b17r7) */
 ['transition-spaces','tools/transition-spaces/test-transition-spaces.cjs'],/* b19: transition stance/path data (stances.json) vs d9423886 geometry */
 ['basket-obstacles','tools/transition-spaces/test-basket-obstacles.cjs'],/* b19: state-toggled basket discs data (transition-anchors.json basketObstacles), unbaked, edges routed round */
 ['sky-exit-door-b','tools/transitions-continuous/test_sky_exit_door_b.cjs'],/* cand7: door B faces the sky deck with the landing yaw */
 ['basket-obstacle-runtime','tools/transition-spaces/test-basket-obstacle-runtime.cjs'],['vertex-color-black','tools/skycity/test_vertex_color_black.cjs'],['static-names','tools/static-names/check-names.cjs'],/* cand10: whole-project tsc gate on undefined names / unresolved imports */['dock-runtime','tools/dock-models/test_dock_runtime.cjs'],/* cand7: b19 dock models runtime wiring (gangway extras, placeholders, ropes, basket obstacles) */
];
/* P0 r16: geometry-heavy checks (real GLB triangles, ~155 s alone) get 360 s; everything else keeps 180 s. */
const SLOW_TIMEOUT_MS={'lakeside-lens-guard':360000,'explore-drag-rotate':360000,'lens-trajectory-clearance':600000,'clip19-regressions':600000,'sky-walk-whole':360000};
const selection=process.argv.slice(2);const selected=selection.length?tests.filter(([id])=>selection.includes(id)):tests;
if(selection.some(id=>!tests.some(t=>t[0]===id)))throw Error('Unknown test id');
// GGbot b17: non-gating REPORT tests (运镜bot route matrix). They run and keep their reports; a nonzero exit is status REPORT, never FAIL.
const REPORT_ONLY=new Set(['route-occlusion','route-framing','route-continuity']);
const git=a=>cp.execFileSync('git',a,{cwd:ROOT,encoding:'utf8'}).trim();
const startedAt=new Date().toISOString(),gitHead=git(['rev-parse','HEAD']),gitTree=git(['rev-parse','HEAD^{tree}']),gitShort=git(['rev-parse','--short=7','HEAD']);
// Provenance first: which commit/tree and when (UTC) this suite output belongs to.
console.log(`== SUITE HEAD=${gitHead} tree=${gitTree} short=${gitShort} utc=${startedAt} node=${process.version}`);
const report={startedAt,startedAtUTC:startedAt,gitHead,gitTree,gitShort,worktreeStatus:git(['status','--short']),testRuntime:process.version,typescriptModule:process.env.QF_TYPESCRIPT_MODULE||null,status:'RUNNING',renderedAcceptance:'BLOCKED_NOT_RUN',deviceAcceptance:'NOT_RUN',checks:[]};
for(const [id,file]of selected){const p=path.join(ROOT,file);if(!fs.existsSync(p)){report.checks.push({id,file,status:'BLOCKED',reason:'Required development commit has not been integrated'});continue;}const content=fs.readFileSync(p,'utf8');if(/chromium\.launch|firefox\.launch|webkit\.launch|launchPersistentContext|chromiumExecutable/.test(content)){report.checks.push({id,file,status:'BLOCKED',reason:'Browser-launching legacy suite is excluded from this Node-only runner; use an authorized browser adapter and official artifact'});console.log(id+': BLOCKED_BROWSER');continue;}const started=Date.now(),r=cp.spawnSync(process.execPath,[file],{cwd:ROOT,env:{...process.env,QF_JOURNEY_SOURCE_ROOT:ROOT},encoding:'utf8',timeout:SLOW_TIMEOUT_MS[id]||180000,maxBuffer:20*1024*1024});const stdout=r.stdout||'',stderr=r.stderr||'';fs.writeFileSync(path.join(out,id+'.stdout.txt'),stdout);fs.writeFileSync(path.join(out,id+'.stderr.txt'),stderr);report.checks.push({id,file,sourceSHA256:crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex'),status:r.status===0?'PASS':REPORT_ONLY.has(id)&&!r.error&&!r.signal?'REPORT':r.status===78&&/^BLOCKED_NODE: /m.test(stderr)?'BLOCKED':'FAIL',reason:r.status===78&&/^BLOCKED_NODE: /m.test(stderr)?(stderr.match(/^BLOCKED_NODE: (.*)$/m)||[])[1]:undefined,exitCode:r.status,signal:r.signal,error:r.error?String(r.error):null,durationMs:Date.now()-started,stdout:id+'.stdout.txt',stderr:id+'.stderr.txt'});console.log(id+': '+(report.checks.at(-1).reason&&report.checks.at(-1).status==='BLOCKED'?'BLOCKED_NODE ('+report.checks.at(-1).reason+')':report.checks.at(-1).status));}
report.finishedAt=new Date().toISOString();report.status=report.checks.some(x=>x.status==='FAIL')?'FAIL':report.checks.some(x=>x.status==='BLOCKED')?'BLOCKED':'PASS';report.scope='Production logic and Cocos component doubles only. No official Creator build, actual browser/WebGL rendering, user data, physical device or WeChat execution.';fs.writeFileSync(path.join(out,'suite.json'),JSON.stringify(report,null,2)+'\n');fs.writeFileSync(path.join(out,`suite.${gitShort}.json`),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({status:report.status,total:report.checks.length,passed:report.checks.filter(x=>x.status==='PASS').length,report:report.checks.filter(x=>x.status==='REPORT').map(x=>x.id),renderedAcceptance:report.renderedAcceptance},null,2));if(report.status!=='PASS')process.exitCode=1;
