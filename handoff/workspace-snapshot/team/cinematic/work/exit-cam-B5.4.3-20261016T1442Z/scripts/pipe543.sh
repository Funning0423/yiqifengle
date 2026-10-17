#!/bin/bash
# B5.4.3 resumable pipeline (nice 19, one job at a time): sail check -> 10 fps frames B543, B53 (sea fix) -> compose -> frame tests
cd /tmp/b52; O=/tmp/b543v10; mkdir -p $O /workspace/wechat-game/team/cinematic/work/exit-cam-B5.4.3-20261016T1442Z/sail; st(){ echo "[x] $1 ($(TZ=America/New_York date +%H:%M) ET)" >> /workspace/wechat-game/team/cinematic/work/exit-cam-B5.4.3-20261016T1442Z/STATUS; }
if [ ! -f /workspace/wechat-game/team/cinematic/work/exit-cam-B5.4.3-20261016T1442Z/sail/summary.json ]; then
  python3 /workspace/wechat-game/team/cinematic/work/sail-cam-signcheck-C-A2-20261016T0416Z/scripts/sail_track.py /workspace/wechat-game/team/cinematic/work/sailboat-transition-storyboard/transition_island_to_meadow.timing.json /workspace/wechat-game/team/cinematic/work/exit-cam-B5.4.3-20261016T1442Z/sail/track_sail.json > /workspace/wechat-game/team/cinematic/work/exit-cam-B5.4.3-20261016T1442Z/sail/track.log 2>&1
  for v in T9; do nice -n 19 blender -b -P /workspace/wechat-game/team/cinematic/work/sail-cam-signcheck-C-A2-20261016T0416Z/scripts/sail_measure_bl.py -- /workspace/wechat-game/team/cinematic/work/exit-cam-B5.4.3-20261016T1442Z/sail/scene_T9current.json /workspace/wechat-game/team/cinematic/work/exit-cam-B5.4.3-20261016T1442Z/sail/track_sail.json /workspace/wechat-game/team/cinematic/work/exit-cam-B5.4.3-20261016T1442Z/sail/m_$v.json > /workspace/wechat-game/team/cinematic/work/exit-cam-B5.4.3-20261016T1442Z/sail/measure_$v.log 2>&1; done
  python3 - <<'PY'
import json;D='/workspace/wechat-game/team/cinematic/work/exit-cam-B5.4.3-20261016T1442Z/sail';s={}
for v in ('T9',):
  M=json.load(open(f'{D}/m_{v}.json'));I=[m for m in M if m['scene']=='island']
  s[v]=dict(island_frames=len(I),start_cam=[I[0]['cam_x'],I[0]['cam_y'],I[0]['cam_z']],start_fov=I[0]['fov'],min_sign=min(m['dist_signpost'] for m in I),min_palm=min(m['dist_beach_palm_tall'] for m in I),min_island=min(m['dist_island'] for m in I),occluded_frames=[m['frame'] for m in I if m['actor_visible'] and (m['occl_face'] or m['occl_head'])])
json.dump(s,open(f'{D}/summary.json','w'),indent=1)
PY
  st "sail check -> sail/summary.json"
fi
for n in B543 B53; do
  while true; do
    python3 - $n <<'PY' || break
import json,os,sys
n=sys.argv[1];j=json.load(open(f'job53_{n}.json'));F=json.load(open(j['frames']))['frames'];N=int(round(F[-1]['t']*10))+1
miss=[k for k in range(N) if not os.path.exists(f'/tmp/b543v10/{n}_046_{k:04d}.png')]
if not miss: sys.exit(1)
j.update(fps=10,outdir='/tmp/b543v10',indices=miss[:20]);json.dump(j,open(f'/tmp/b52/batch_{n}.json','w'))
PY
    nice -n 19 blender -b -t 4 -P render543.py -- batch_$n.json >> $O/$n.log 2>&1
  done
done
[ -f $O/renders.done ] || { touch $O/renders.done; st "frames rendered (B543 + B53, sea fix)"; }
if [ ! -f /workspace/wechat-game/team/cinematic/work/exit-cam-B5.4.3-20261016T1442Z/video/exit_B5.3_vs_B5.4.3_0.46.mp4 ]; then nice -n 19 python3 compose543.py /workspace/wechat-game/team/cinematic/work/exit-cam-B5.4.3-20261016T1442Z/video/exit_B5.3_vs_B5.4.3_0.46.mp4 > $O/compose.log 2>&1 && st "video composed" && rm -rf /tmp/b543v10/*.png /tmp/b543comp; fi
nice -n 19 bash /tmp/b5/seqtests.sh && st "frame tests ran -> /tmp/b543t"
echo ALLDONE > $O/done543
