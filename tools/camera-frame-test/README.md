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
