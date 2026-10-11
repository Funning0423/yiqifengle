// T6 preview: draws the 4 tiers exactly with CheerTextModel styles/pose (outline 4, shadow 0,-3 blur 2), on a light and a dark board tone.
// Row A: system font as shipped (box has no Arial Rounded MT Bold -> Liberation Sans Bold stands in for the Android fallback).
// Row B: Fredoka (rounded) = what a bitmap-font atlas would look like (NOT shipped; comparison only). Row C: Amazing! animation frames.
import {createRequire} from 'module';const require=createRequire(import.meta.url);
const NM=process.env.NM||'/workspace/yiqifengle/work/GGbot/tools/vendor-node/node_modules';const {createCanvas,GlobalFonts}=require(NM+'/@napi-rs/canvas');
const M=await import('./test/out/ui/CheerTextModel.js');
for(const f of ['/usr/share/fonts/truetype/sand-box/google/Fredoka/Fredoka-VariableFont_wdth,wght.ttf'])try{GlobalFonts.registerFromPath(f,'FredokaPreview');}catch{}
const out=process.argv[2]||'/tmp/t6-cheer-preview.png';const W=1180,H=560,S=2;const c=createCanvas(W*S,H*S),g=c.getContext('2d');g.scale(S,S);
g.fillStyle='#F6EEDC';g.fillRect(0,0,W/2,H);g.fillStyle='#2F6F73';g.fillRect(W/2,0,W/2,H);
function word(st,x,y,family,scale=1,alpha=1){g.save();g.globalAlpha=alpha;g.translate(x,y);g.scale(scale,scale);g.font=`bold ${st.size}px ${family}`;g.textAlign='center';g.textBaseline='middle';g.lineJoin='round';
 g.shadowColor=st.shadow;g.shadowOffsetY=3;g.shadowBlur=2;g.lineWidth=8;g.strokeStyle=st.outline;g.strokeText(st.word,0,0);g.shadowColor='transparent';g.fillStyle=st.fill;g.fillText(st.word,0,0);g.restore();}
g.font='13px "Liberation Sans"';g.fillStyle='#555';g.fillText('A: shipped (system font Label, Android-like fallback)',10,18);g.fillText('B: rounded bitmap-font look (Fredoka) - not shipped',10,208);g.fillText('C: Amazing! at t = 0, .06, .12, .18, .3, .5, .65, .78 s',10,398);
for(const [half,ox] of [[0,0],[1,W/2]])M.CHEER_STYLES.forEach((st,i)=>{const x=ox+150+(i%2)*290,y=(i<2?70:140);word(st,x,y,'"Liberation Sans"');word(st,x,y+190,'FredokaPreview');});
const p={};[0,.06,.12,.18,.3,.5,.65,.78].forEach((t,i)=>{M.poseAt(t,p);const x=75+i*140;word(M.CHEER_STYLES[2],x,500-p.dy,'"Liberation Sans"',p.scale*0.8,p.alpha);});
require('fs').writeFileSync(out,c.toBuffer('image/png'));console.log(out);
