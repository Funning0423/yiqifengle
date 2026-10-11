// T6b preview: renders the SHIPPED bitmap look from the real atlas + .fnt (no TTF involved): per glyph quads tinted like
// Label.color (white texel * tint), drawn in node order [3 shadow copies, 8 outline copies, fill], BMFont scale = size/38.
// Row A: system-font fallback (Liberation Sans Bold stands in for Android). Row B: bitmap font as shipped. Row C: Amazing! frames.
// Usage: node tools/t6-cheer-text/preview-bitmap.mjs out.png   (run test/run.sh first: it transpiles CheerTextModel)
import {createRequire} from 'module';import fs from 'fs';import path from 'path';import {fileURLToPath} from 'url';const require=createRequire(import.meta.url);
const NM=process.env.NM||'/workspace/yiqifengle/work/GGbot/tools/vendor-node/node_modules';const {createCanvas,loadImage}=require(NM+'/@napi-rs/canvas');
const H=path.dirname(fileURLToPath(import.meta.url));const M=await import('./test/out/ui/CheerTextModel.js');
const FD=path.join(H,'../../creator-build-project/assets/resources/ui/cheer-font');const atlas=await loadImage(fs.readFileSync(path.join(FD,'cheer-fredoka.png')));
const L=fs.readFileSync(path.join(FD,'cheer-fredoka.fnt'),'utf8').split('\n');const kv=l=>Object.fromEntries([...l.matchAll(/(\w+)=(-?\d+)/g)].map(m=>[m[1],+m[2]]));
const info=kv(L[0]);const glyph={};for(const l of L)if(l.startsWith('char ')){const c=kv(l);glyph[c.id]=c;}
const tints={};const tinted=hex=>{if(tints[hex])return tints[hex];const c=createCanvas(atlas.width,atlas.height),x=c.getContext('2d');x.drawImage(atlas,0,0);x.globalCompositeOperation='source-in';x.fillStyle=hex;x.fillRect(0,0,c.width,c.height);return tints[hex]=c;};
function bmLabel(g,st,hex,cx,cy){const s=st.size/info.size;let pen=0,right=0;for(const ch of st.word){const q=glyph[ch.charCodeAt(0)];right=Math.max(right,pen+(q.xoffset+q.width)*s);pen+=q.xadvance*s;}
 const lh=st.size+8,x0=cx-right/2,top=cy-lh/2+(lh-47*s)/2;pen=0;const img=tinted(hex);
 for(const ch of st.word){const q=glyph[ch.charCodeAt(0)];g.drawImage(img,q.x,q.y,q.width,q.height,x0+pen+q.xoffset*s,top+q.yoffset*s,q.width*s,q.height*s);pen+=q.xadvance*s;}}
function bitmapWord(g,st,x,y,scale=1,alpha=1){g.save();g.globalAlpha=alpha;g.translate(x,y);g.scale(scale,scale);g.imageSmoothingEnabled=true;
 for(const [dx,dy] of M.CHEER_SHADOW_OFFSETS)bmLabel(g,st,M.opaque(st.shadow),dx,-dy);for(const [dx,dy] of M.CHEER_OUTLINE_OFFSETS)bmLabel(g,st,st.outline,dx,-dy);bmLabel(g,st,st.fill,0,0);g.restore();}
function systemWord(g,st,x,y){g.save();g.translate(x,y);g.font=`bold ${st.size}px "Liberation Sans"`;g.textAlign='center';g.textBaseline='middle';g.lineJoin='round';
 g.shadowColor=st.shadow;g.shadowOffsetY=3;g.shadowBlur=2;g.lineWidth=8;g.strokeStyle=st.outline;g.strokeText(st.word,0,0);g.shadowColor='transparent';g.fillStyle=st.fill;g.fillText(st.word,0,0);g.restore();}
const out=process.argv[2]||'/tmp/t6-cheer-preview-bitmap.png';const W=1180,Hh=560,S=2;const c=createCanvas(W*S,Hh*S),g=c.getContext('2d');g.scale(S,S);
g.fillStyle='#F6EEDC';g.fillRect(0,0,W/2,Hh);g.fillStyle='#2F6F73';g.fillRect(W/2,0,W/2,Hh);
g.font='13px "Liberation Sans"';g.fillStyle='#555';g.fillText('A: fallback only (system-font Label; Liberation Sans Bold stands in for Android)',10,18);
g.fillText(`B: SHIPPED bitmap font - real atlas cheer-fredoka.png (${fs.statSync(path.join(FD,'cheer-fredoka.png')).size} B), shown at 2x device pixels`,10,208);g.fillText('C: Amazing! (bitmap) at t = 0, .06, .12, .18, .3, .5, .65, .78 s',10,398);
for(const ox of [0,W/2])M.CHEER_STYLES.forEach((st,i)=>{const x=ox+150+(i%2)*290,y=(i<2?70:140);systemWord(g,st,x,y);bitmapWord(g,st,x,y+190);});
const p={};[0,.06,.12,.18,.3,.5,.65,.78].forEach((t,i)=>{M.poseAt(t,p);bitmapWord(g,M.CHEER_STYLES[2],75+i*140,500-p.dy,p.scale*0.8,p.alpha);});
fs.writeFileSync(out,c.toBuffer('image/png'));console.log(out);
