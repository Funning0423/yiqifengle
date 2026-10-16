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
// Journey wiring (board background does not set journeyNight).
assert(/motion\.journeyNight=true;motion\.clouds=meadowCloudMaterials\(find\(model,'meadow_clouds_near'\)\)/.test(ad),'journey enables grade on meadow_clouds_near');
assert(!/journeyNight=true/.test(bg),'board background stays on the old grade');
console.log('meadow night grade OK',want.map(v=>v.toFixed(3)).join(','));
