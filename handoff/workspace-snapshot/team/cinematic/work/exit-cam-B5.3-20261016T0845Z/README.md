# Exit camera B5.3, stage 1: end pose + timing (local only, NOT pushed)
Commit 00fea6336b57f982430b24be5e39073131210e1a (tree fbe950e9c154d1e540ed95fa58f1b8b270146745) on cine/exit-cam-B5. Parent: B5.2 468b2d7.

- **End pose:** pos (-15.5, 9, 14) → target (-2, 2.5, 1), vertical FOV 60.
  - 16.0 m from her horizontally, on her right, 57° off her front.
- **Total:** 19.97 s, of which 17.4 s comes after the door key.
- **Peak speed:** 1.96 m/s constant walk / 2.16 m/s real walk (cap 2.2).
- **Max accel:** 1.28–1.96 m/s². **Max jerk:** 11.5 / 21.3 m/s³.
- **Motion:**
  - straight-line offset blend from follow to end pose
  - speed profile with smooth ramps: 45% ease-in, 25% ease-out
  - heightShare 0.65
- **Clearance:**
  - props: 1.23 m minimum
  - lighthouse wall at the doorway: 0.51 m (exempt)
  - gull flight path: 2.79 m
- **Occlusion:** face/head/chest never blocked after the door.
- **Final frame** (raycast with the game's Main Light, euler (-30,-30,0)):
  - feet, chest and face all sunlit
  - line of sight to her clear
  - whole lighthouse, island and sea in view at both ratios
- **Suite:** everything passes except:
  - composition (also failed on B5–B5.2)
  - real-walk return-entry-continuous (also failed on B5–B5.2)
  - wind-frontal was rewritten (camera never behind her face, max 59.6°) and now passes.
- **Sail check, C/A2:** no occlusion. Nearest: signpost 18.2 m, palm 18.9 m, island 9.9 m.
- **Timing (30 fps):** door 76, peak 248, walk end 260, wind full 448–503, crane 455, settled / sailboat start 599.

## Progress
- [x] stills, timing, tests, sail, patch
- [x] curve plot plots/curves_B51_vs_B53.png
- [x] video/exit_B5.1_vs_B5.3_0.46.mp4 (10 fps rendered, 30 fps encode, 240x520 per side, 20.1 s; B5.1 holds last frame)
