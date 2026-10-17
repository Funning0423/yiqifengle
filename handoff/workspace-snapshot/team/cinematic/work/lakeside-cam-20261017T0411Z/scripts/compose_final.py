# Final frames side by side (360x780): fallback final | new landing end (she has stopped) | new board camera (after the blend).
import sys,json
from PIL import Image,ImageDraw,ImageFont
D=sys.argv[1];sha=sys.argv[2];F=ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf',14)
plan=json.load(open(D+'/scripts/plan.json'));stop=[f['i'] for f in plan['frames'] if f['t']>=plan['D']-1e-9][0];last=plan['frames'][-1]['i']
im=[('FALLBACK final',D+'/renders/fallback/f%05d.png'%last),('NEW landing end (t %.0f s)'%plan['D'],D+'/renders/new/f%05d.png'%stop),('NEW board camera (+%.0f s)'%plan['blendS'],D+'/renders/new/f%05d.png'%last)]
I=[Image.open(p).convert('RGB') for _,p in im];o=Image.new('RGB',(sum(i.width for i in I)+16,I[0].height+30),(20,20,20));x=0
for (t,_),i in zip(im,I):o.paste(i,(x,30));ImageDraw.Draw(o).text((x+6,7),t,font=F,fill=(235,235,235));x+=i.width+8
o.save(D+'/stills/final_frames_side_by_side_360x780_%s.png'%sha);print('ok')
