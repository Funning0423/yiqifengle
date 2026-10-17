// r4.2 item 7 (Mac r4 2153a65: sun x/z flipped on the FIRST level-loading frame). The level adapter marks the board lease visible at
// the end of enter() while its host is still hidden (level-loading: the island/journey camera draws). The lease used to take the
// scene's shared main light right there (board yaw), so the journey picture flipped its sun for the whole loading shot. Now the
// lease takes the light only on the frame its own camera draws (reveal), and hands it back when it stops drawing.
// Real LakesideBoardBackground on a fake cc (tools/lakeside/lakeside-lease-fake.cjs), both the direct build and the preload/adopt path.
const assert=require('node:assert/strict');
const {createLakesideFake}=require('./lakeside-lease-fake.cjs');
const run=async(n,f)=>{await f();console.log('PASS',n);};
async function scenario(preload){
 const F=createLakesideFake();F.setMode('day');
 const B=F.load(F.S+'region/LakesideBoardBackground.ts'),A=F.load(F.S+'region/LakesideJourneyAtmosphere.ts'),Sun=F.load(F.S+'region/LakesideSunDirection.ts'),W=F.load(F.S+'world-r1/WorldFlowCore.ts');
 const JOURNEY=[0.1,-0.8,0.59];F.lightNode.rotation.fwd=JOURNEY;/* whatever the journey wrote last (its lake yaw) */
 const host=new F.Node('ManagedNativeBoardHost');host.active=false;F.scene.addChild(host);
 if(preload){const p=B.preloadLakesideBoard();await F.flushFrames();await p;}
 const lease=await B.createLakesideBoardBackground({parent:host,selection:{stageId:'lake-1'},token:new W.Cancellation()});
 const cam=()=>F.scene.getComponentsInChildren(F.Camera).find(c=>c.priority===44);
 // LevelBackgroundBinding.load → setVisible(false); NativeWorldLevelAdapter.enter end → setVisible(true) + frame() with the host hidden
 lease.setVisible(false);lease.setVisible(true);lease.frame(true,{width:390,height:844});
 assert.deepEqual(F.lightNode.rotation.fwd,JOURNEY,'level-loading (host hidden): the journey sun is untouched');
 assert.equal(F.lightNode.looks||0,0,'no lookAt on the shared light before the board draws');
 assert.equal(A.lakesideBoardHolding(),false,'journey keeps owning the lakeside lighting while loading');
 assert.equal(cam().enabledInHierarchy,false,'board camera not drawing yet');
 assert.equal(lease.diagnostics().mainLightHeld,false);
 // reveal: host shown, setVisible(true), layout → frame
 host.active=true;lease.setVisible(true);lease.frame(true,{width:390,height:844});
 assert.equal(cam().enabledInHierarchy,true,'board camera draws after reveal');
 const f0=Sun.lakesideSunForward(Sun.LAKESIDE_BOARD_YAW_DEG),fl=Math.hypot(...f0),f=f0.map(v=>v/fl),got=F.lightNode.rotation.fwd;
 for(let i=0;i<3;i++)assert(Math.abs(got[i]-f[i])<1e-9,'board sun on the reveal frame '+got);
 assert.equal(A.lakesideBoardHolding(),true);assert.equal(lease.diagnostics().mainLightHeld,true);
 // leave: back to the journey sun
 lease.setVisible(false);assert.deepEqual(F.lightNode.rotation.fwd,JOURNEY,'hide restores the journey sun');assert.equal(A.lakesideBoardHolding(),false);
 lease.dispose();}
(async()=>{
 await run('direct build: no shared-sun write while the board host is hidden; board sun exactly on reveal; restore on hide',()=>scenario(false));
 await run('preload/adopt path: same',()=>scenario(true));
 await run('wiring: applyDir only through drawing() (setVisible, frame, adopt, day/night)',()=>{
  const bg=require('node:fs').readFileSync(require('node:path').join(__dirname,'../../creator-build-project/assets/scripts/region/LakesideBoardBackground.ts'),'utf8');
  assert.match(bg,/const drawing=\(\)=>visible&&!dead&&!!camera&&isValid\(camera,true\)&&camera\.enabled&&!!camera\.node&&camera\.node\.activeInHierarchy;/);
  const body=bg.slice(bg.indexOf('return {\n   adopt:'));assert.doesNotMatch(body.slice(0,body.indexOf('dispose,\n')),/[;{]applyDir\(\)/,'lease methods never call applyDir directly');});
})().catch(e=>{console.error(e);process.exit(1);});
