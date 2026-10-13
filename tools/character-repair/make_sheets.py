from PIL import Image,ImageDraw,ImageFont
from pathlib import Path
import json
out=Path('output/character-repair');frames=out/'frames';rows=json.loads((out/'skin-audit.json').read_text())['source'];font=ImageFont.load_default()
for part in range(2):
 sub=rows[part*7:(part+1)*7];sheet=Image.new('RGB',(960,7*350),(27,29,32));d=ImageDraw.Draw(sheet)
 for i,row in enumerate(sub):
  clip=row['clip'];y=i*350
  for col,(name,label) in enumerate([(f'before-{clip}-full','Before'),(f'after-{clip}-full','Candidate'),('reference-full','Reference: seated only, native scale')]):
   im=Image.open(frames/(name+'.png')).convert('RGB');im.thumbnail((310,310));sheet.paste(im,(col*320+(320-im.width)//2,y+35));d.text((col*320+7,y+6),f'{clip} | {label}',font=font,fill='white')
 sheet.save(out/f'pose-sheet-{part+1}.jpg',quality=88)
for row in rows:
 clip=row['clip'];sheet=Image.new('RGB',(1280,720),(27,29,32));d=ImageDraw.Draw(sheet)
 for i,(label,area) in enumerate([('before','wrist'),('after','wrist'),('before','heel'),('after','heel')]):
  im=Image.open(frames/f'{label}-{clip}-{area}.png').convert('RGB');sheet.paste(im,(i*320,35));d.text((i*320+8,10),f'{label} {area}',font=font,fill='white')
 for i,label in enumerate(['before','after']):
  im=Image.open(frames/f'{label}-{clip}-full.png').convert('RGB');im.thumbnail((220,330));sheet.paste(im,(i*320+55,380));d.text((i*320+8,360),label+' full',font=font,fill='white')
 for i,area in enumerate(['boots','head_cuff']):
  im=Image.open(frames/f'reference-{area}.png').convert('RGB');im.thumbnail((320,320));sheet.paste(im,((i+2)*320,390));d.text(((i+2)*320+8,360),'reference '+area,font=font,fill='white')
 (out/'comparisons').mkdir(exist_ok=True);sheet.save(out/'comparisons'/f'{clip}.jpg',quality=90)
