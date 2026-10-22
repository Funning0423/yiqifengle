// N2: on the night journey the meadow grass and topmost cloud follow the world night grade.
const fs=require('fs'),path=require('path'),assert=require('assert');
const A=path.join(__dirname,'..','creator-build-project','assets');
const rd=p=>fs.readFileSync(path.join(A,p),'utf8');
const fx=rd('bundles/region_meadow/meadow-grass-wind.effect'),bg=rd('scripts/region/MeadowBoardBackground.ts'),ad=rd('scripts/region/RegionJourneyAdapter.ts'),dn=rd('scripts/world-r1/DayNightContract.ts'),wf=rd('scripts/world-r1/WorldFlowComponent.ts');
// Grass: journey night constant == lightScale x moon colour (linear), board keeps the old sea tint.
const scale=+dn.match(/lightScale:\s*night\s*\?\s*([\d.]+)/)[1],moon=dn.match(/lightColor:\s*night\s*\?\s*\[([^\]]+)\]/)[1].split(',').map(Number);
const lin=c=>{c/=255;return c<=.04045?c/12.92:Math.pow((c+.055)/1.055,2.4);};
const want=moon.map(c=>scale*lin(c));
const m=fx.match(/mix\(vec3\(0\.50, 0\.62, 0\.70\), vec3\(([\d.]+), ([\d.]+), ([\d.]+)\), windParams\.w\)/);assert(m,'grass night grade keyed on windParams.w');
m.slice(1).map(Number).forEach((v,i)=>assert(Math.abs(v-want[i])<.006,'grass night channel '+i+' '+v+' vs '+want[i].toFixed(3)));
assert(/mix\(vec3\(1\.0\), nightK, windParams\.z\)/.test(fx),'night weight still drives the mix');
assert(/new Vec4\(this\.seconds,1,night,this\.journeyNight\?1:0\)/.test(bg),'motion writes w from journeyNight');
// Cloud: same tint as env_cloud_layer in bindUnlitBackdrop.
const cl=wf.match(/name==='env_cloud_layer'\?\[([^\]]+)\]/)[1],ct=bg.match(/MEADOW_CLOUD_NIGHT_TINT:readonly number\[\]=\[([^\]]+)\]/)[1];
assert.deepStrictEqual(ct.split(',').map(Number),cl.split(',').map(Number),'cloud tint matches env_cloud_layer');
const f=new Function('MEADOW_CLOUD_NIGHT_TINT','return '+bg.match(/export function meadowCloudColor\(w:number\):number\[\]\{([^\n]+)\}/)[1].replace(/^const t=/,'(w)=>{const t=').replace(/:number/g,'')+'}')(ct.split(',').map(Number));
assert.deepStrictEqual(f(0),[1,1,1]);assert.deepStrictEqual(f(1).map(v=>+v.toFixed(2)),[.22,.28,.43]);assert.deepStrictEqual(f(2).map(v=>+v.toFixed(2)),[.22,.28,.43]);
// Journey wiring. r4.2 item 9 (Mac r4: daytime board behind a night journey): the board background now uses the same grade (tools/meadow/test_region_board_night.cjs).
assert(/motion\.journeyNight=true;motion\.clouds=meadowCloudMaterials\(find\(model,'meadow_clouds_near'\)\)/.test(ad),'journey enables grade on meadow_clouds_near');
assert(/motion\.journeyNight=true;motion\.clouds=meadowCloudMaterials\(find\(model,'meadow_clouds_near'\)\)/.test(bg),'r4.2 item 9: board background follows the same night grade as the journey');
console.log('meadow night grade OK',want.map(v=>v.toFixed(3)).join(','));
// N2b: the ground (terrain + river bank) follows the same journey night grade.
{
 const g=bg.match(/MEADOW_NIGHT_LINEAR:readonly number\[\]=\[([^\]]+)\]/);assert(g,'ground night constant');
 g[1].split(',').map(Number).forEach((v,i)=>assert(Math.abs(v-want[i])<.006,'ground grade '+i));
 const s2l=c=>c<=.04045?c/12.92:Math.pow((c+.055)/1.055,2.4),l2s=c=>c<=.0031308?c*12.92:1.055*Math.pow(c,1/2.4)-.055;
 const fac=w=>g[1].split(',').map(Number).map(k=>1+(l2s(k)-1)*Math.max(0,Math.min(1,w)));
 assert.deepStrictEqual(fac(0),[1,1,1]);fac(1).forEach((v,i)=>assert(Math.abs(s2l(v)-want[i])<.006,'ground linear '+i));
 assert(/MEADOW_NIGHT_LINEAR\.map\(k=>1\+\(linToSrgb\(k\)-1\)\*t\)/.test(bg),'factor formula');
 assert(/if\(this\.journeyNight\)for\(const g of this\.grounds\)\{const k=meadowGroundFactor\(night,g\.f\);g\.m\.setProperty\('mainColor'/.test(bg),'motion grades grounds');
 assert(/motion\.grounds=meadowGroundMaterials\(\[find\(model,'meadow_terrain'\),find\(model,'meadow_river_bank'\)\]\)/.test(ad),'journey wires terrain+bank');
 console.log('meadow ground night grade OK');
}
// N3: path and windmill dim to x0.6 at full night through the same grounds/night-weight path.
{
 const m=bg.match(/MEADOW_PROP_NIGHT:readonly number\[\]=\[([^\]]+)\]/);assert(m,'prop night constant');
 m[1].split(',').map(Number).forEach(v=>assert(Math.abs(v-.6)<1e-9,'x0.6'));
 const fac=(w,f)=>f.map(k=>1+(k-1)*Math.max(0,Math.min(1,w)));assert.deepStrictEqual(fac(0,[.6,.6,.6]),[1,1,1]);assert.deepStrictEqual(fac(1,[.6,.6,.6]).map(v=>+v.toFixed(6)),[.6,.6,.6]);
 assert(/return f\?f\.map\(k=>1\+\(k-1\)\*t\)/.test(bg),'factor uses per-entry f');
 assert(/meadowGroundFactor\(night,g\.f\)/.test(bg),'motion passes per-entry factor');
 assert(/meadowGroundMaterials\(\[find\(model,'meadow_path'\),find\(model,'windmill_static_merged'\),find\(model,'windmill_sails'\)\],MEADOW_PROP_NIGHT\)/.test(ad),'path + windmill wired');
 assert(!/RainbowBridgeStrip/.test(ad),'rainbow bridge removed (b16)');
 assert(/if\(motion&&model\)motion\.grounds\.push/.test(ad),'meadow journey only');
 console.log('meadow prop night grade OK');
}
