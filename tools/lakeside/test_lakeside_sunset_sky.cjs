// PR79 sunset backdrop (scene design): the Funning accept PNG 20261105 (= renders/lakeside_r5_still_graded.png) shows the r5 warm
// fog sunset over the far hills; the r5h3 Cocos port showed LK_far_hills on the blue day clear colour. Locks: the backdrop table is
// warm (red > green > blue in every cell), brightest toward the sun side (+azimuth), the sphere encloses the far hills and the PR79
// lens, it is one mesh (positions/colours/indices consistent), it is mounted by the board lease after the static merge, never by
// the journey, day only, destroyed on dispose; no camera parameter is touched.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const ts=require(process.env.QF_TYPESCRIPT_MODULE||'typescript');
const S=path.join(__dirname,'../../creator-build-project/assets/scripts/region/');
const tsjs=src=>ts.transpileModule(src,{compilerOptions:{module:1,target:7}}).outputText;
const m={exports:{}};new Function('module','exports','require',tsjs(fs.readFileSync(S+'LakesideSceneData.ts','utf8')))(m,m.exports,require);
const D=m.exports,K=D.LAKESIDE_SUNSET_SKY,run=(n,f)=>{f();console.log('PASS',n);};
run('table shape + warm sunset colours',()=>{
 assert.equal(K.srgb.length,K.elevDeg.length);for(const r of K.srgb){assert.equal(r.length,K.azDeg.length);for(const c of r){assert.equal(c.length,3);assert(c.every(v=>Number.isInteger(v)&&v>=0&&v<=255));assert(c[0]>c[1]&&c[1]>c[2],'warm '+c);}}
 for(let i=1;i<K.elevDeg.length;i++)assert(K.elevDeg[i]>K.elevDeg[i-1]);for(let i=1;i<K.azDeg.length;i++)assert(K.azDeg[i]>K.azDeg[i-1]);
 for(let i=1;i<K.ringsDeg.length;i++)assert(K.ringsDeg[i]>K.ringsDeg[i-1]);assert.equal(K.ringsDeg[0],-90);assert.equal(K.ringsDeg[K.ringsDeg.length-1],90);
 const lum=c=>c[0]+c[1]+c[2],top=K.elevDeg.length-1;assert(lum(K.srgb[top][K.azDeg.length-1])>lum(K.srgb[top][0]),'sun side brighter');});
run('colour lookup: exact at stops, clamped outside, bilinear between',()=>{
 assert.deepEqual(D.lakesideSunsetSkyColor(K.elevDeg[3],K.azDeg[2]),Array.from(K.srgb[3][2]));
 assert.deepEqual(D.lakesideSunsetSkyColor(80,170),Array.from(K.srgb[K.elevDeg.length-1][K.azDeg.length-1]));
 assert.deepEqual(D.lakesideSunsetSkyColor(-80,-170),Array.from(K.srgb[0][0]));
 const a=K.srgb[0][0],b=K.srgb[0][1],mid=D.lakesideSunsetSkyColor(K.elevDeg[0],(K.azDeg[0]+K.azDeg[1])/2);for(let k=0;k<3;k++)assert(Math.abs(mid[k]-(a[k]+b[k])/2)<=0.5);});
run('sphere encloses far hills and the PR79 lens; one consistent mesh',()=>{
 const g=D.lakesideSunsetSkyGeometry(),nv=g.positions.length/3;assert.equal(g.colors.length,nv*4);assert.equal(nv,K.ringsDeg.length*(K.segments+1));
 assert.equal(g.indices.length,(K.ringsDeg.length-1)*K.segments*6);assert(g.indices.every(i=>i>=0&&i<nv));assert(nv<65535);
 const c=K.center;for(let i=0;i<nv;i++){const d=Math.hypot(g.positions[i*3]-c[0],g.positions[i*3+1]-c[1],g.positions[i*3+2]-c[2]);assert(Math.abs(d-K.radius)<0.01);}
 // LK_far_hills.glb POSITION bounds x +-240, z -250..230, y <= 40.8: every corner inside the sphere; PR79 portraitFusion.main [0,12.75,22.75] inside; far clip 1000 beyond
 for(const p of [[240,40.82,-250],[-240,40.82,-250],[240,40.82,230],[-240,-2.01,230]])assert(Math.hypot(p[0]-c[0],p[1]-c[1],p[2]-c[2])<K.radius,'hills corner '+p);
 assert(Math.hypot(0-c[0],12.75-c[1],22.75-c[2])+K.radius<D.LAKESIDE_BOARD_CAMERA.far);});
run('board lease wiring: after static merge + setLayer, day only, disposed; journey never mounts it; camera untouched',()=>{
 const src=fs.readFileSync(S+'LakesideBoardBackground.ts','utf8');
 const iMerge=src.indexOf("step='static-merge'"),iSky=src.indexOf("sunsetSky=mountLakesideSunsetSky(scenery)"),iLayer=src.indexOf('setLayer(scenery);',iMerge),iCam=src.indexOf("step='lights-camera'",iMerge);
 assert(iMerge>0&&iLayer>iMerge&&iSky>iLayer&&iCam>iSky,'mounted after the static merge + setLayer, before lights/camera');
 assert(/node=new Node\('LakesideSunsetSky'\);node\.layer=LAKESIDE_LAYER;/.test(src),'own layer = the board layer');
 assert(/effectName:'builtin-unlit'[^}]*defines:\{USE_VERTEX_COLOR:true\}/.test(src));assert(/depthWrite:false/.test(src.slice(src.indexOf('export function mountLakesideSunsetSky'))));
 assert(src.includes('sunsetSky.node.active=lakesideSunsetSkyActive(mode)'));assert(src.includes('sunsetSky.mesh.destroy();sunsetSky.mat.destroy()'));
 const fn=src.slice(src.indexOf('export function mountLakesideSunsetSky'),src.indexOf('export function lakesideSunsetSkyActive'));assert(!/camera|Camera|fov/i.test(fn.replace(/board camera/g,'')),'no camera writes in the sky mount');
 for(const f of fs.readdirSync(S))if(/Journey/.test(f)&&f.endsWith('.ts'))assert(!fs.readFileSync(S+f,'utf8').includes('mountLakesideSunsetSky'),f+' must not mount the backdrop');});
run('day only',()=>{const src=fs.readFileSync(S+'LakesideBoardBackground.ts','utf8');assert(/return !LAKESIDE_SUNSET_SKY\.dayOnly\|\|mode==='day';/.test(src));assert.equal(K.dayOnly,true);});
