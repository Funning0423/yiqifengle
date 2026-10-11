# camera-frame-test (QA only, not shipped)

Node 23.11 (`work/GGbot/tools/vendor-node/node-runtime`) or Node >= 20 for the frame test; python3 + ffmpeg for video.

    # CPU frame test: real WorldFlow + routes + camera tracks, 60 fps, home -> island -> home
    node tools/camera-frame-test/test_camera_frames.cjs [--json out.json] [--no-geometry]
    # geometry needs draco3d 1.5.7: DRACO3D=<dir> or `npm i --no-save draco3d@1.5.7` here
    # (auto-detects ../vendor-node and work/GGbot/tools/vendor-node)

    # native video check (Mac recording)
    python3 tools/camera-frame-test/video_frame_check.py <video.mp4> --start 22 --end 24 [--expect-flag]
    python3 tools/camera-frame-test/video_frame_check.py <video.mp4> --gb-log run.log \
        --video-start-mark <mark at video t=0> --from-mark crane-start --to-mark camera-settled:island --pad 0.5

## T2+ additions
`test_camera_frames.cjs` now also checks: lighting-monotone (T5 w), crane-marks (prints crane start/settle times for audio),
rail-distance-band (3.5–5 m), drag-rejoin-continuous (second run: `leaveHome({from: door-facing view})`), and
room-camera-inside (every home pose variant: 16 horizontal + up/down rays must hit room geometry, <= 4 window/door openings).
`--no-drag` skips the second run. `flow_sim.cjs` script entries may be `['op', arg]`.
Mac: same commands as above (node >= 20; draco3d from GGbot's vendor-node or `npm i --no-save draco3d@1.5.7`).

## Lens coverage, turn targets, real walk driver (Mac round 2 follow-up)
- `collision:lens-near-geometry` (in test_camera_frames): every frame casts a 16x32 ray grid through the real frustum
  (586x1266, per-frame FOV). FAIL if any ray hits non-architecture geometry (props, palms, fences, bushes, T9) within
  1.0 m of the lens (lens_rays.cjs NEAR_M). Room/tower shell is reported only (the lens lives in the room and crosses the door
  frame; collision:lens-clearance >= 0.15 m covers it). Coverage within 2.5 m is reported per phase (outbound / return /
  island idle + static cameraIsland). Non-occluding FX (`fx_*`, sky/sea/cloud/smoke/glass/beam/glow) are not in the ray index.
- `test_turn_targets.cjs`: turn targets taken from a path start/end use the first point >= 0.05 m away
  (WorldFlowCore.pathHeading); every flow turn meets the following walk within 20 deg.
- `--real-walk`: GGbot's real walk driver (FlowReferenceStandin + CharacterMotion + committed character GLB) is the character;
  the camera follows its own walkProgress(). Combine with QF_TS_TARGET=ES5.
- `dump_camera_track.cjs [out.json]`: per-frame camera pose track (outbound / islandIdle / return) for offline intersection tests.
- `--walk-profile accel` (0.3 s ramps on EVERY split walk action, worst case) fails in-frame by <= 2.7 % (pre-existing since
  138bca5); `chained` (ramps only at real starts/stops) is the gate and passes.
