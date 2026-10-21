'use strict';
// Real web-test only. QA commands place the camera; this script never writes meshes, materials or scenery visibility.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{spawn}=require('node:child_process');
const env=require('../qf-env.cjs'),root=path.resolve(__dirname,'../..');
const web=path.join(root,'creator-build-project/build/web-test'),out=path.join(root,'docs/r5/skyground-r3/shots');
const port=Number(process.env.QF_SHOT_PORT||8783),url=`http://127.0.0.1:${port}/?qa=1`;
async function main(){
 const index=path.join(web,'index.html'),glb=path.join(root,'creator-build-project/assets/bundles/region_skycity/env_sky_cloudsea_soft.glb');
 assert(fs.existsSync(index),'build web-test first');assert(fs.statSync(index).mtimeMs>=fs.statSync(glb).mtimeMs,'web-test predates r3 source');
 fs.mkdirSync(out,{recursive:true});
 // Refuse a used port, so we never accidentally photograph another checkout or stop another server.
 const net=require('node:net');await new Promise((ok,fail)=>{const probe=net.createServer();probe.once('error',fail);probe.listen(port,'127.0.0.1',()=>probe.close(ok));});
 const server=spawn('python3',['-m','http.server',String(port),'--bind','127.0.0.1','--directory',web],{stdio:'ignore'});
 let browser=null;const errors=[],frames=[];
 try{
  let ready=false;for(let i=0;i<40;i++){try{ready=(await fetch(url)).ok;}catch{}if(ready)break;await new Promise(r=>setTimeout(r,250));}assert(ready,'own HTTP server ready');
  browser=await env.playwright().chromium.launch({headless:true,executablePath:env.chromiumExecutable()});
  const page=await browser.newPage({viewport:{width:390,height:844},deviceScaleFactor:1,hasTouch:true,isMobile:true});
  page.on('pageerror',e=>errors.push(String(e)));page.on('console',m=>{if(m.type()==='error'&&!/ERR_CONNECTION_RESET/.test(m.text()))errors.push(m.text());});
  await page.addInitScript(()=>{Date.prototype.getHours=function(){return 14;};});
  await page.goto(url,{waitUntil:'domcontentloaded',timeout:180000});
  await page.waitForFunction(()=>{try{return !!globalThis.__worldIntegration?.qaShot&&globalThis.__worldIntegration.snapshot().characterReady;}catch{return false;}},null,{timeout:180000});
  const entered=await page.evaluate(()=>globalThis.__worldIntegration.qaShot({region:'skycity'}));assert(entered.ok,JSON.stringify(entered));
  await page.evaluate(()=>globalThis.__worldDayNight.set('day'));
  const specs=[{name:'02_skycity_south',cam:[-8,2.5,40],look:[50,-0.6,55.5]},
   {name:'03_skycity_foliage',local:[12,.2,2],yawDeg:220,pitchDeg:42,dist:6.2}];
  for(const spec of specs){
   const pose=await page.evaluate(async spec=>{
    const {director,Component}=await System.import('cc'),scene=director.getScene();
    const stage=scene.getComponentsInChildren(Component).find(c=>typeof c.toWorld==='function'&&typeof c.frame==='function');if(!stage)throw Error('QA stage missing');
    let position,target;
    if(spec.cam){position=stage.toWorld('skycity',[spec.cam])[0];target=stage.toWorld('skycity',[spec.look])[0];}
    else{
     const feet=stage.toWorld('skycity',[spec.local])[0];target=[feet[0],feet[1]+1.25,feet[2]];
     const y=spec.yawDeg*Math.PI/180,p=spec.pitchDeg*Math.PI/180;
     position=[target[0]+Math.sin(y)*Math.cos(p)*spec.dist,target[1]+Math.sin(p)*spec.dist,target[2]+Math.cos(y)*Math.cos(p)*spec.dist];
    }
    stage.holdPose={position,target,fovVerticalDeg:48};stage.lens='FollowWalk';return {position,target,fov:48};
   },spec);
   await page.waitForTimeout(600);
   const runtime=await inspect(page);checkRuntime(runtime);
   // Screenshot action is restricted to this game canvas; no desktop or other apps are captured.
   const canvas=page.locator('#GameCanvas');assert.equal(await canvas.count(),1);const box=await canvas.boundingBox();assert.equal(box?.width,390);assert.equal(box?.height,844);await canvas.screenshot({path:path.join(out,spec.name+'.png'),type:'png',scale:'css'});
   frames.push({spec,pose,runtime});
  }
  const board=await page.evaluate(()=>globalThis.__worldIntegration.qaShot({region:'skycity',lens:'board'}));assert(board.ok,JSON.stringify(board));await page.waitForTimeout(600);
  const boardSamples=[];for(let i=0;i<20;i++){await page.waitForTimeout(50);const r=await inspect(page);checkRuntime(r);assert(Number.isFinite(r.drawCalls)&&r.drawCalls>0&&r.drawCalls<=64,'sky board DC '+r.drawCalls);boardSamples.push(r.drawCalls);}
  assert.deepEqual(errors,[],'runtime errors');
  fs.writeFileSync(path.join(out,'runtime.json'),JSON.stringify({status:'PASS',utc:new Date().toISOString(),viewport:[390,844],hour:14,frames,boardDrawCalls:boardSamples,errors},null,2)+'\n');
  console.log(JSON.stringify({status:'PASS',shots:frames.map(f=>f.spec.name),boardDrawCalls:boardSamples}));
 }finally{try{if(browser)await browser.close();}finally{server.kill('SIGTERM');await new Promise(r=>server.once('exit',r));}}
}
async function inspect(page){return page.evaluate(async()=>{
 const {director,Component,MeshRenderer,Camera}=await System.import('cc'),scene=director.getScene();
 const find=(n,name)=>{if(n.name===name)return n;for(const c of n.children){const h=find(c,name);if(h)return h;}return null;};
 const owners=scene.getComponentsInChildren(Component).filter(c=>typeof c.setFlightHidden==='function'&&c.node.activeInHierarchy);
 const sky=owners.map(c=>{
  const soft=c.node.parent.children.find(n=>n.name==='SkycityCloudseaSoft'&&n.activeInHierarchy);if(!soft)return {missingSoft:true};
  const renderers=soft.getComponentsInChildren(MeshRenderer),base=c.node.getComponentsInChildren(MeshRenderer);
  return {sameParent:soft.parent===c.node.parent,sameTransform:['position','rotation','scale'].every(k=>(k==='rotation'?['x','y','z','w']:['x','y','z']).every(key=>soft[k][key]===c.node[k][key])),
   paletteShared:renderers.every(r=>base.some(b=>b.sharedMaterials.some(m=>m===r.sharedMaterials[0]&&m?.name==='M_sky_palette'))),
   noShadow:renderers.every(r=>r.shadowCastingMode===0&&!r.receiveShadow),layers:soft.layer===c.node.layer&&renderers.every(r=>r.node.layer===c.node.layer),
   states:Object.fromEntries(['env_sky_cloudsea','env_sky_cumulus_far','env_sky_cloud_small','env_sky_islets_far'].map(name=>[name,find(c.node,name)?.activeInHierarchy])),
   strides:[...base,...renderers].flatMap(r=>r.mesh?.struct.vertexBundles.map(b=>b.view.stride)||[]),softVertices:renderers.map(r=>r.mesh?.struct.vertexBundles[0].view.count)};
 });
 const room=find(scene,'room_no_original_chair');
 const roomSkyDomeActive=room?find(room,'env_sky_dome')?.activeInHierarchy:false;
 return {roomSkyDomeActive,sky,sea:find(scene,'env_sea_surface')?.activeInHierarchy,cameras:scene.getComponentsInChildren(Camera).filter(c=>c.enabled&&c.node.activeInHierarchy).map(c=>({name:c.node.name,far:c.far})),day:globalThis.__worldDayNight.snapshot(),drawCalls:director.root.device.numDrawCalls};
});}
function checkRuntime(r){
 assert(r.sky.length>0,'active sky city');assert.equal(r.sea,false);assert.equal(r.day.mode,'day');assert.equal(r.day.lightScale,1);
 assert.equal(r.roomSkyDomeActive,false,'day skycity must hide the old room env_sky_dome');
 for(const s of r.sky){assert(!s.missingSoft);assert(s.sameParent&&s.sameTransform&&s.paletteShared&&s.noShadow&&s.layers,JSON.stringify(s));assert(s.strides.every(n=>n%4===0),'WebGL stride');assert.deepEqual(s.softVertices,[7078]);
  assert.deepEqual(s.states,{env_sky_cloudsea:false,env_sky_cumulus_far:false,env_sky_cloud_small:true,env_sky_islets_far:true});}
 const world=r.cameras.filter(c=>!/UI|Navigation/.test(c.name));assert(world.length>0);assert(world.every(c=>c.far>=1200),JSON.stringify(world));
}
main().catch(e=>{console.error(e);process.exitCode=1;});
