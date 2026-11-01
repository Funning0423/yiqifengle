#!/usr/bin/env node
'use strict';
/** Side-by-side game | render. PIL keeps PNG upright (no flipY). Labels: 左＝游戏 / 右＝效果图. */
const fs=require('fs'),path=require('path'),{execFileSync}=require('child_process');
const ROOT=path.resolve(__dirname,'../..');
const SHOTS=path.join(ROOT,'docs/r5/balloon-v25fix/shots');
const ART='/Users/shineanl/cursor-tasks/r5-balloon-v24fix/art/renders';
const TASK_SHOTS=path.resolve('/Users/shineanl/cursor-tasks/r5-balloon-v25fix/shots');
const PAIRS=[
 {game:'01_board.png',render:'r5_balloon_01_board_v2_3.png',out:'01_board_vs_render.png'},
 {game:'02_liftoff.png',render:'r5_balloon_02_liftoff_v2_3.png',out:'02_liftoff_vs_render.png'},
 {game:'03_clouds.png',render:'r5_balloon_03_through_clouds_v2_3.png',out:'03_clouds_vs_render.png'},
 {game:'04_cruise.png',render:'r5_balloon_04_cruise_v2_3.png',out:'04_cruise_vs_render.png'},
 {game:'05_city.png',render:'r5_balloon_05_city_sighted_v2_3.png',out:'05_city_vs_render.png'},
 {game:'06_land.png',render:'r5_balloon_06_landing_v2_3.png',out:'06_land_vs_render.png'},
 {game:'07_night.png',render:'r5_balloon_07_night_v2_3.png',out:'07_night_vs_render.png'},
];
async function withPil(){
 const {execFileSync:ex}=require('child_process');
 const py=`
import sys
from PIL import Image, ImageDraw, ImageFont
font=ImageFont.truetype('/System/Library/Fonts/STHeiti Light.ttc', 42)
pairs=${JSON.stringify(PAIRS)}
shots=${JSON.stringify(SHOTS)}
art=${JSON.stringify(ART)}
rows=[]
for p in pairs:
    g=Image.open(shots+'/'+p['game']).convert('RGB')
    r=Image.open(art+'/'+p['render']).convert('RGB')
    if min(g.size)<844:
        s=844/min(g.size); g=g.resize((round(g.width*s), round(g.height*s)), Image.Resampling.LANCZOS)
    if r.height!=g.height:
        s=g.height/r.height; r=r.resize((round(r.width*s), g.height), Image.Resampling.LANCZOS)
    W,H=g.width+r.width, g.height
    im=Image.new('RGB',(W,H),(255,255,255))
    im.paste(g,(0,0)); im.paste(r,(g.width,0))
    d=ImageDraw.Draw(im)
    def tag(text,x):
        box=d.textbbox((0,0),text,font=font)
        tw,th=box[2]-box[0], box[3]-box[1]
        d.rectangle([x,16,x+tw+28,16+th+18], fill=(0,0,0))
        d.text((x+14,22), text, font=font, fill=(255,255,255))
    tag('左＝游戏', 24)
    tag('右＝效果图', g.width+24)
    out=shots+'/'+p['out']
    im.save(out, 'PNG', optimize=True)
    rows.append(out)
    print('OK', p['out'], W, H)
if len(rows)==7:
    imgs=[Image.open(p).convert('RGB') for p in rows]
    W=max(i.width for i in imgs); H=sum(i.height for i in imgs)
    sheet=Image.new('RGB',(W,H),(255,255,255)); y=0
    for i in imgs:
        sheet.paste(i,(0,y)); y+=i.height
    dest=shots+'/contact_vs_render_v2_3.png'
    sheet.save(dest,'PNG', optimize=True)
    print(dest, W, H)
`
 execFileSync('python3',['-c',py],{stdio:'inherit'});
}
async function main(){
 fs.mkdirSync(SHOTS,{recursive:true});
 fs.mkdirSync(TASK_SHOTS,{recursive:true});
 await withPil();
 for(const name of fs.readdirSync(SHOTS)){
  if(!name.endsWith('.png'))continue;
  const src=path.join(SHOTS,name), st=fs.statSync(src);
  if(st.size>1.5*1024*1024 && !name.startsWith('contact')){
   try{execFileSync('pngquant',['--force','--output',src,'--quality=65-85',src]);}catch{}
  }
  fs.copyFileSync(src,path.join(TASK_SHOTS,name));
 }
 const contact=path.join(SHOTS,'contact_vs_render_v2_3.png');
 if(fs.existsSync(contact) && fs.statSync(contact).size>1.5*1024*1024){
  try{execFileSync('pngquant',['--force','--output',contact,'--quality=55-75',contact]);
   fs.copyFileSync(contact,path.join(TASK_SHOTS,'contact_vs_render_v2_3.png'));}catch{}
 }
}
main().catch(e=>{console.error(e);process.exit(1);});
