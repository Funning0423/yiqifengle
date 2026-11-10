const L=require('./lib.cjs'),fs=require('fs');const RW=L.J.H.load(L.J.S+'region/RegionWalkable.ts');
const N=JSON.parse(fs.readFileSync(__dirname+'/../region-nodes/region-nodes.json')).island;
const G=L.J.island.filter(o=>/island_main|sand|terrain|ground|dock|tide|shells/.test(o.name)&&!/palm/.test(o.name));
const gh=(x,z)=>{let b=null,who=null;for(const o of G){o.bb??=L.J.bbox(o.tris);if(x<o.bb[0][0]||x>o.bb[1][0]||z<o.bb[0][2]||z>o.bb[1][2])continue;const t=L.J.rayHit([x,8,z],[0,-1,0],20,o.tris);if(t!==null&&(b===null||8-t>b)){b=8-t;who=o.name;}}return [b,who];};
const PM=L.J.island.filter(o=>/props_merged|rock|stone/.test(o.name));const ob=(x,z,g)=>{let h=0,who=null;for(const o of PM){o.bb??=L.J.bbox(o.tris);if(x<o.bb[0][0]||x>o.bb[1][0]||z<o.bb[0][2]||z>o.bb[1][2])continue;const t=L.J.rayHit([x,8,z],[0,-1,0],20,o.tris);if(t!==null&&8-t-g>h){h=8-t-g;who=o.name;}}return [h,who];};
const out={grounds:G.map(o=>o.name),legs:{}};
for(const e of N.edges){const p=e.path,Lt=L.plen(p),rows=[];for(let s=0;s<=Lt+1e-9;s+=0.05){const g=L.along(p,s);const w=RW.walkFloorY('island',g[0],g[2]);const [h,who]=gh(g[0],g[2]);const [oh,ow]=ob(g[0],g[2],h??g[1]);rows.push([+s.toFixed(2),+g[0].toFixed(3),+g[2].toFixed(3),+g[1].toFixed(3),h===null?null:+h.toFixed(3),w==null||!isFinite(w)?null:+w.toFixed(3),who,+oh.toFixed(3),ow]);}
 const unw=rows.filter(r=>r[5]===null);let maxGap=0,maxJump=0,noGround=0;for(let i=0;i<rows.length;i++){const r=rows[i];if(r[4]===null){noGround++;continue;}maxGap=Math.max(maxGap,Math.abs(r[4]-r[3]));if(i&&rows[i-1][4]!==null)maxJump=Math.max(maxJump,Math.abs(r[4]-rows[i-1][4]));}
 let maxGapU=0,maxObU=0,obN=0;for(const r of unw){if(r[4]!==null)maxGapU=Math.max(maxGapU,Math.abs(r[4]-r[3]));maxObU=Math.max(maxObU,r[7]);if(r[7]>0.12)obN++;}
 out.legs[e.a+'-'+e.b]={n:rows.length,unwalkable:unw.length,noGround,maxFootGapM:+maxGap.toFixed(3),maxFootGapOnUnwalkableM:+maxGapU.toFixed(3),maxGroundJumpPer5cmM:+maxJump.toFixed(3),maxPropAboveGroundOnUnwalkableM:+maxObU.toFixed(3),unwalkableWithPropOver12cm:obN,rows};}
fs.writeFileSync(process.argv[2],JSON.stringify(out));
for(const [k,v] of Object.entries(out.legs))console.log(k,'n',v.n,'unw',v.unwalkable,'noGround',v.noGround,'gap',v.maxFootGapM,'gapUnw',v.maxFootGapOnUnwalkableM,'jump',v.maxGroundJumpPer5cmM,'propUnw',v.maxPropAboveGroundOnUnwalkableM,v.unwalkableWithPropOver12cm);
console.log(out.grounds.join(','));
