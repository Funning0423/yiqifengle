from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
import json,hashlib
base=Path(__file__).resolve().parents[1]
out=base/'tools/branding/game-title-temporary.png'
out.parent.mkdir(exist_ok=True)
image=Image.new('RGBA',(960,320),(0,0,0,0))
draw=ImageDraw.Draw(image)
font=ImageFont.truetype('/System/Library/Fonts/Supplemental/Songti.ttc',110)
title='\u54a6\uff0c\u8d77\u98ce\u4e86'
box=draw.textbbox((0,0),title,font=font)
x=(960-(box[2]-box[0]))/2-box[0]
y=(320-(box[3]-box[1]))/2-box[1]
draw.text((x,y),title,font=font,fill=(255,249,228,255))
image.save(out,optimize=True)
print(json.dumps({'path':str(out),'dimensions':[960,320],'bytes':out.stat().st_size,'sha256':hashlib.sha256(out.read_bytes()).hexdigest()}))

