import json,subprocess
O='/workspace/wechat-game/team/cinematic/work/window-tap-exit/v5-foreground-glass/';F='/usr/share/fonts/opentype/noto/NotoSansCJK-Bold.ttc'
def run(c):subprocess.run(c,shell=True,check=True)
def dur(f):return float(subprocess.check_output(f'ffprobe -v error -show_entries format=duration -of csv=p=0 {f}',shell=True))
lab=lambda t,y,s=22:f"drawtext=fontfile={F}:text='{t}':x=(w-tw)/2:y={y}:fontsize={s}:fontcolor=white:box=1:boxcolor=black@0.55:boxborderw=8"
for W,H in [(360,780),(390,520)]:
  a=f'{W/H:.2f}';S=f'scale={W*2}:{H*2}:flags=lanczos,format=yuv420p';R=f'/tmp/wte/rec5b/glass_{W}/frames/%05d.png';T=f'/tmp/wte/v5b_{W}_'
  # right v5: deterministic 30fps frames; seg1 = 0..169, seg2 = 170..end (tap at 185)
  run(f'ffmpeg -y -v error -framerate 30 -i {R} -vf "trim=end_frame=170,setpts=PTS-STARTPTS,{S}" -c:v libx264 -crf 18 {T}r1.mp4')
  run(f'ffmpeg -y -v error -framerate 30 -i {R} -vf "trim=start_frame=170,setpts=PTS-STARTPTS,{S}" -c:v libx264 -crf 18 {T}r2.mp4')
  # left v4: swipe retimed to same length; tap 0.5s pre-roll as v5; exit
  v=f'/tmp/wte/c5_v4_{W}_';d1=dur(v+'1.mp4')
  run(f'ffmpeg -y -v error -i {v}1.mp4 -vf "setpts=PTS*{170/30/d1:.4f},fps=30,{S}" -c:v libx264 -crf 18 {T}l1.mp4')
  run(f'ffmpeg -y -v error -ss 0.5 -i {v}2a.mp4 -i {v}2b.mp4 -filter_complex "[0]setpts=PTS-STARTPTS[x];[x][1]concat=n=2:v=1,{S}[o]" -map "[o]" -c:v libx264 -crf 18 {T}l2.mp4')
  for seg,cap in [('1','① 滑动看房间'),('2','② 点击→出门（1倍速）')]:
    D=max(dur(T+'l'+seg+'.mp4'),dur(T+'r'+seg+'.mp4'))
    run(f'ffmpeg -y -v error -i {T}l{seg}.mp4 -i {T}r{seg}.mp4 -filter_complex "[0]tpad=stop=-1:stop_mode=clone,{lab("左 v4 窗前玻璃牌",H*2-60)}[l];[1]tpad=stop=-1:stop_mode=clone,{lab("右 v5 前景玻璃牌",H*2-60)}[r];[l][r]hstack,{lab(cap,16)},format=yuv420p[o]" -map "[o]" -t {D:.2f} -c:v libx264 -crf 18 {T}s{seg}.mp4')
  f=f'{O}video/side-by-side_v4_vs_v5-foreground-glass_{a}.mp4'
  run(f'ffmpeg -y -v error -i {T}s1.mp4 -i {T}s2.mp4 -filter_complex "[0][1]concat=n=2:v=1[o]" -map "[o]" -c:v libx264 -crf 18 -pix_fmt yuv420p {f}')
  d=dur(T+'s1.mp4')
  for n,t in [('1_home',0.2),('2_swipe-left',1.5),('3_swipe-right',3.6),('4_exit',d+10.0)]:
    run(f'ffmpeg -y -v error -ss {t} -i {f} -frames:v 1 {O}shots/sbs_{a}_{n}.png')
  # v5 full-res stills straight from frames
  for n,k in [('home',0),('swipe-left',40),('swipe-right',95),('tap_f00',185),('tap_f04',189),('tap_f10',195),('tap_f18',203),('tap_f24',209),('exit',400)]:
    run(f'cp /tmp/wte/rec5b/glass_{W}/frames/{k:05d}.png {O}shots/v5_{a}_{n}.png')
  run(f'ffmpeg -y -v error -framerate 30 -i {R} -vf "trim=start_frame=185:end_frame=215,select=not(mod(n\\,3)),crop=iw*0.75:ih*0.3:0:ih*0.42,tile=5x2" -frames:v 1 {O}shots/v5_{a}_tap-feedback_zoom_every3frames.png')
