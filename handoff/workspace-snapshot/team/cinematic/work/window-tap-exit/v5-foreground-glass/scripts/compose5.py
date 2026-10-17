import json,subprocess,glob
O='/workspace/wechat-game/team/cinematic/work/window-tap-exit/v5-foreground-glass/';F='/usr/share/fonts/opentype/noto/NotoSansCJK-Bold.ttc'
def run(c):subprocess.run(c,shell=True,check=True)
def dur(f):return float(subprocess.check_output(f'ffprobe -v error -show_entries format=duration -of csv=p=0 {f}',shell=True))
for W,H in [(360,780),(390,520)]:
  a=W/H;sc=2;P={}
  for v,root in [('v4','/tmp/wte/rec4/'),('v5','/tmp/wte/rec5/')]:
    d=root+f'glass_{W}/';m=dict(json.load(open(d+'marks.json')));src=glob.glob(d+'*.webm')[0];o=f'/tmp/wte/c5_{v}_{W}_'
    s1,e1,tap,wk,end=m['seg1_start'],m['seg1_end'],m['seg2_tap'],m['walking'],m['end']
    vf=f'fps=30,scale={W*sc}:{H*sc}:flags=lanczos,format=yuv420p'
    run(f'ffmpeg -y -v error -ss {s1-1.5} -t {e1-s1+1.5} -i "{src}" -vf "setpts=PTS/{(e1-s1)/6:.3f},{vf}" -an -c:v libx264 -crf 18 {o}1.mp4')
    run(f'ffmpeg -y -v error -ss {tap-1} -t 2.5 -i "{src}" -vf "{vf}" -an -c:v libx264 -crf 18 {o}2a.mp4')
    run(f'ffmpeg -y -v error -ss {wk-1} -t {end-wk+1} -i "{src}" -vf "{vf}" -an -c:v libx264 -crf 18 {o}2b.mp4')
    P[v]=o
  lab=lambda t,y:f"drawtext=fontfile={F}:text='{t}':x=(w-tw)/2:y={y}:fontsize=22:fontcolor=white:box=1:boxcolor=black@0.55:boxborderw=8"
  for seg,cap in [('1','① 滑动看房间（时间压缩）'),('2a','② 点击反馈（1倍速）'),('2b','③ 出门镜头（1倍速，剪掉卡顿等待）')]:
    D=max(dur(P['v4']+seg+'.mp4'),dur(P['v5']+seg+'.mp4'))
    run(f'ffmpeg -y -v error -i {P["v4"]}{seg}.mp4 -i {P["v5"]}{seg}.mp4 -filter_complex "[0]tpad=stop=-1:stop_mode=clone,{lab("左 v4 窗前玻璃牌",H*sc-60)}[l];[1]tpad=stop=-1:stop_mode=clone,{lab("右 v5 前景玻璃牌",H*sc-60)}[r];[l][r]hstack,{lab(cap,16)},format=yuv420p[o]" -map "[o]" -t {D:.2f} -c:v libx264 -crf 18 /tmp/wte/c5s_{seg}_{W}.mp4')
  run(f'ffmpeg -y -v error -i /tmp/wte/c5s_1_{W}.mp4 -i /tmp/wte/c5s_2a_{W}.mp4 -i /tmp/wte/c5s_2b_{W}.mp4 -filter_complex "[0][1][2]concat=n=3:v=1[o]" -map "[o]" -c:v libx264 -crf 18 -pix_fmt yuv420p "{O}video/side-by-side_v4_vs_v5-foreground-glass_{a:.2f}.mp4"')
  d1=dur(f'/tmp/wte/c5s_1_{W}.mp4')
  f=f'{O}video/side-by-side_v4_vs_v5-foreground-glass_{a:.2f}.mp4'
  for n,t in [('1_home',0.3),('2_swipe-left',2.6),('3_swipe-right',5.0),('4_exit',d1+2.5+4.0)]:
    run(f'ffmpeg -y -v error -ss {t} -i {f} -frames:v 1 {O}shots/sbs_{a:.2f}_{n}.png')
  run(f'ffmpeg -y -v error -ss 0.9 -t 1.5 -i {P["v5"]}2a.mp4 -vf "select=\'not(mod(n\\,3))\',tile=5x3" -frames:v 1 {O}shots/v5_tap-feedback_{a:.2f}_every3frames.png')
