# Board stills as the player sees them: Blender 3D background + the 2D board tray (board_art/board/tray_frame.png, opaque)
# at BoardLayout's tray rect (plan.json board[size].tray). *_ui.png = tray opaque; *_align.png = tray at 35% with the 2D 7x7
# grid drawn in red over the 3D lake grid (LK_wb_line), to show the alignment.
import json,sys
from PIL import Image,ImageDraw
D=sys.argv[1];plan=json.load(open(D+'/scripts/plan.json'));tray=Image.open('/workspace/wechat-game/work/wt-lk/creator-build-project/assets/bundles/board_art/board/tray_frame.png').convert('RGBA')
for size,b in plan['board'].items():
  for kind in ('new','handoff'):
    src=f'{D}/stills/board_{kind}_{size}.png'
    try:bg=Image.open(src).convert('RGBA')
    except FileNotFoundError:continue
    t=b['tray'];g=b['grid'];P=b['pitch'];x0=round(t['x']-t['width']/2);y0=round(t['y']-t['height']/2);tr=tray.resize((round(t['width']),round(t['height'])),Image.LANCZOS)
    ui=bg.copy();ui.alpha_composite(tr,(x0,y0));ui.convert('RGB').save(f'{D}/stills/board_{kind}_{size}_ui.png')
    al=bg.copy();tt=tr.copy();tt.putalpha(tt.getchannel('A').point(lambda a:int(a*.35)));al.alpha_composite(tt,(x0,y0))
    dr=ImageDraw.Draw(al);gx=g['x']-g['size']/2;gy=g['y']-g['size']/2
    for k in range(8):dr.line([(gx+k*P,gy),(gx+k*P,gy+g['size'])],fill=(230,40,40,255),width=1);dr.line([(gx,gy+k*P),(gx+g['size'],gy+k*P)],fill=(230,40,40,255),width=1)
    al.convert('RGB').save(f'{D}/stills/board_{kind}_{size}_align.png')
print('ok')
