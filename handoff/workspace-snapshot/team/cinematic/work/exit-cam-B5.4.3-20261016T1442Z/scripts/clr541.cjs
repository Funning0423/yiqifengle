// non-exempt min clearance per frame: index built from geometry minus lens_rays ARCH (and interior/door), every frame after door key
const path=require('path'),fs=require('fs');const wt='/tmp/wt-b5';const G=require(path.join(wt,'tools/camera-frame-test/glb_geometry.cjs')),T9=require(path.join(wt,'tools/camera-frame-test/t9_props.cjs')),LR=require(path.join(wt,'tools/camera-frame-test/lens_rays.cjs'));
(async()=>{const geo=await T9.merged(await G.decode());
 const filt={...geo,meshes:Object.fromEntries(Object.entries(geo.meshes).filter(([n])=>!(LR.ARCH.test(n)||/@(open|closed)$/.test(n))))};console.error('meshes',Object.keys(geo.meshes).length,'->',Object.keys(filt.meshes).length);
 const I=G.index(filt);const F=JSON.parse(fs.readFileSync(process.argv[2])).frames,tC=+process.argv[3];let m={d:9};const prof=[];
 for(const f of F){if(f.t<tC)continue;const c=I.clearance(f.pos,2);prof.push([+f.t.toFixed(3),+c.d.toFixed(3),c.who]);if(c.d<m.d)m={d:c.d,who:c.who,t:f.t};}
 fs.writeFileSync(process.argv[4]||'/tmp/b5/clr_prof.json',JSON.stringify(prof));console.log(JSON.stringify({minNonExempt:+m.d.toFixed(3),mesh:m.who,t:+m.t.toFixed(3),excluded:String(LR.ARCH)}));})();
