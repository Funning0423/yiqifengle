import json,subprocess,glob,sys
R='/tmp/wte/rec4/';O='/workspace/wechat-game/team/cinematic/work/window-tap-exit/v4-floating-glass/'
F='/usr/share/fonts/opentype/noto/NotoSansCJK-Bold.ttc'
def run(c):print(c);subprocess.run(c,shell=True,check=True)
for W,H in [(360,780),(390,520)]:
  a=W/H;sc=2  # upscale to 2x for viewing
  parts={}
  for v in ['sill','glass']:
    d=R+f'{v}_{W}/';m=dict(json.load(open(d+'marks.json')));src=glob.glob(d+'*.webm')[0]
    s1,e1,tap,end=m['seg1_start'],m['seg1_end'],m['seg2_tap'],m['end']
    sp=(e1-s1)/6.0
    run(f'ffmpeg -y -v error -ss {s1-1.5} -t {e1-s1+1.5} -i "{src}" -vf "setpts=PTS/{sp:.3f},fps=30,scale={W*sc}:{H*sc}:flags=lanczos" -an -c:v libx264 -crf 18 -pix_fmt yuv420p {d}seg1.mp4')
    run(f'ffmpeg -y -v error -ss {tap-1.0} -t {end-tap+1.0} -i "{src}" -vf "fps=30,scale={W*sc}:{H*sc}:flags=lanczos" -an -c:v libx264 -crf 18 -pix_fmt yuv420p {d}seg2.mp4')
    parts[v]=d
  lab=lambda t,y:f"drawtext=fontfile={F}:text='{t}':x=(w-tw)/2:y={y}:fontsize={22*sc//2*2}:fontcolor=white:box=1:boxcolor=black@0.55:boxborderw=8"
  def dur(f):return float(subprocess.check_output(f'ffprobe -v error -show_entries format=duration -of csv=p=0 {f}',shell=True))
  for seg,cap in [('seg1','① 滑动看房间（时间压缩）'),('seg2','② 点击→出门（1倍速）')]:
    run(f'ffmpeg -y -v error -i {parts["sill"]}{seg}.mp4 -i {parts["glass"]}{seg}.mp4 -filter_complex "[0]tpad=stop=-1:stop_mode=clone,{lab("左 v3 窗台小提示",H*sc-60)}[l];[1]tpad=stop=-1:stop_mode=clone,{lab("右 v4 悬浮玻璃牌",H*sc-60)}[r];[l][r]hstack,pad=iw+0:ih:0:0,{lab(cap,16)},format=yuv420p[o]" -map "[o]" -t {max(dur(parts["sill"]+seg+".mp4"),dur(parts["glass"]+seg+".mp4")):.2f} -c:v libx264 -crf 18 /tmp/wte/{seg}_{W}.mp4')
  run(f'ffmpeg -y -v error -i /tmp/wte/seg1_{W}.mp4 -i /tmp/wte/seg2_{W}.mp4 -filter_complex "[0][1]concat=n=2:v=1[o]" -map "[o]" -c:v libx264 -crf 18 -pix_fmt yuv420p "{O}video/side-by-side_v3-sill_vs_v4-floating-glass_{a:.2f}.mp4"')
