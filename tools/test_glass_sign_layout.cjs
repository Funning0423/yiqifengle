// G2/G2b: glass sign leaf is a small committed PNG (no emoji, no Graphics), ~1.1x caption height, 5-6 px gap, group centred.
const fs=require('fs'),path=require('path'),assert=require('assert');
const A=path.join(__dirname,'..','creator-build-project/assets');
const s=fs.readFileSync(path.join(A,'scripts/world-r1/GlassSign.ts'),'utf8');
assert(!/🍃/u.test(s),'no system emoji');assert(!/Graphics/.test(s),'no Graphics leaf');
const m=s.match(/leaf: \{ size: (\d+), png: '([^']+)', bbox: \[(\d+), (\d+), (\d+)\] as const, gap: (\d+) \}/);assert(m,'leaf config');
const [size,png,b0,b1,bw,gap]=[+m[1],m[2],+m[3],+m[4],+m[5],+m[6]];
assert(gap>=5&&gap<=6,'gap 5-6 px');
// PNG: 48x48 RGBA, small, visible bbox matches config
const f=path.join(A,'resources',png.replace(/\/spriteFrame$/,'')+'.png'),buf=fs.readFileSync(f);
assert(buf.length<6000,'png a few KB: '+buf.length);assert.equal(buf.readUInt32BE(16),48);assert.equal(buf.readUInt32BE(20),48);assert.equal(buf[25],6,'RGBA');assert.equal(bw,48);
const meta=JSON.parse(fs.readFileSync(f+'.meta','utf8'));assert.equal(meta.uuid,'848df364-a778-5f96-b167-fce358205792','stable uuid');
for(const sm of Object.values(meta.subMetas)){const u=sm.userData;assert.equal(u.minfilter,'linear');assert.equal(u.magfilter,'linear');assert.equal(u.mipfilter,'none');assert.equal(u.premultiplyAlpha,false);assert.equal(u.wrapModeS,'clamp-to-edge');}
assert.equal(meta.userData.fixAlphaTransparencyArtifacts,true,'alpha bleed for clean edges');
// visible height ~1.1x the 34 px caption (PNG content rows 4..44 of 48)
const visH=40/48*size;assert(visH/34>1.0&&visH/34<1.2,'leaf height ratio '+(visH/34).toFixed(2));
// group geometry mirrors glassSignGroup
assert(/cap\.updateRenderData\(true\)/.test(s)&&/cap\.node\.setPosition\(g\.captionX, 1, 0\)/.test(s)&&/leaf\.setPosition\(g\.leafX, 1, 0\)/.test(s));
for(const capW of [150,170,186,205]){const k=size/bw,visL=b0*k,visW=(b1-b0)*k,total=visW+gap+capW,left=-total/2,leafX=left-visL+size/2,capX=left+visW+gap+capW/2;
 const visLeft=leafX-size/2+visL,visRight=leafX-size/2+b1*k,capLeft=capX-capW/2,capRight=capX+capW/2;
 assert(Math.abs(capLeft-visRight-gap)<1e-9,'gap');assert(Math.abs(visLeft+capRight)<1e-9,'centred');assert(total<=280,'fits card');}
console.log('glass sign layout OK');
