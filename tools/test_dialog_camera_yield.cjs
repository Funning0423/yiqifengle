'use strict';
// 运镜bot r5 dialog camera yield. Uses the real DialogCameraYield.ts (transpiled) and her posed convex hull exported from Blender
// (tools/camera-render/dialog-yield/bl_dialog.py, A1 final GLB, returnFollow.out, progress 0.45/0.60/0.75 of toThreshold).
// Checks: the bubble/tail/name rects from IMPLEMENT.md (ui/r5-design 1f3258c7) stay ≥13 pt from her with dialog open; she is never
// cropped; the lens position never moves; and motion peaks stay under §4 (angular accel ≤120°/s², linear ≤3 m/s²), including a
// close in mid-open and back-to-back toggles at 30/60/120 fps, with no jump (per-frame step × fps ≤ 15°/s, continuous velocity).
const fs=require('fs'),path=require('path'),os=require('os'),assert=require('assert/strict');
const ts=require('./qf-env.cjs').typescript(),src=path.resolve(__dirname,'../creator-build-project/assets/scripts/world-r1'),tmp=fs.mkdtempSync(path.join(os.tmpdir(),'dialog-yield-'));
for(const f of ['CameraPose','DialogCameraYield'])fs.writeFileSync(path.join(tmp,f+'.js'),ts.transpileModule(fs.readFileSync(path.join(src,f+'.ts'),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2018}}).outputText);
const C=require(path.join(tmp,'CameraPose')),Y=require(path.join(tmp,'DialogCameraYield'));
const fx=path.join(__dirname,'fixtures/dialog-yield'),samples=fs.readdirSync(fx).filter(f=>/^girl_hull_p.*\.json$/.test(f)).sort().map(f=>JSON.parse(fs.readFileSync(path.join(fx,f),'utf8')));
const sub=(a,b)=>[a[0]-b[0],a[1]-b[1],a[2]-b[2]],dot=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
// Blender-equivalent projection (vertical sensor fit), pt with y down.
function project(pose,W,H,pts){const f=C.rotate(pose.rotation,[0,0,-1]),r=C.rotate(pose.rotation,[1,0,0]),u=C.rotate(pose.rotation,[0,1,0]),t=Math.tan(pose.fovVerticalDeg*Math.PI/360),a=W/H;
  return pts.map(p=>{const q=sub(p,pose.position),z=dot(q,f);return [(dot(q,r)/(z*t*a)+1)/2*W,(1-dot(q,u)/(z*t))/2*H]})}
function bbox(sp){let b=[1e9,1e9,-1e9,-1e9];for(const [x,y]of sp)b=[Math.min(b[0],x),Math.min(b[1],y),Math.max(b[2],x),Math.max(b[3],y)];return b}
const gapRect=(a,b)=>Math.hypot(Math.max(0,a[0]-b[2],b[0]-a[2]),Math.max(0,a[1]-b[3],b[1]-a[3]));
// IMPLEMENT.md §4–§6 (portrait: safe top 47, bottom 34, left/right 0). Name "阿芳" is 2 characters, so Wt=64.
function layout(W,H,g,headX){const reg=H>=700&&W>=360,lh=reg?26:24,padT=reg?24:22,padB=reg?20:18,bw=Math.min(W-28,480),x0=(W-bw)/2,x1=x0+bw,bottom=H-34-16,Wt=64;
  const lo=Math.max(x0+41,x0+20+Wt+8+11),hi=x1-41,tx=Math.min(hi,Math.max(lo,headX));let keep=g[3]+13;
  if(tx+11>g[0]-13&&tx-11<g[2]+13)keep=Math.max(keep,g[3]+25);if(x0+20+Wt>g[0]-13&&x0+20<g[2]+13)keep=Math.max(keep,g[3]+29);
  const fit=Math.floor((bottom-keep-padT-padB)/lh),n=Math.min(3,Math.max(1,fit)),top=bottom-(padT+n*lh+padB);
  const rects={bubble:[x0,top,x1,bottom],tail:[tx-11,top-12,tx+11,top],name:[x0+20,top-16,x0+20+Wt,top+16]};
  let gap=1e9,by='';for(const k in rects){const d=gapRect(g,rects[k]);if(d<gap){gap=d;by=k}}return {fit,lines:n,top,gap,by,rects}}
function frame(s,W,H,deg){const base=C.fromLookAt(s.camera,60),pose=Y.yieldPose(base,deg),sp=project(pose,W,H,s.hull),g=bbox(sp),head=project(pose,W,H,[[s.girl_root[0],1.45,s.girl_root[2]]])[0];return {pose,g,L:layout(W,H,g,head[0])}}
const screens=[[390,520],[320,568],[360,780],[390,844],[768,1024],[375,667],[414,896]],required=new Set(['390x520','320x568','360x780','390x844','768x1024']);
// 1) the projection matches 棋盘UI美术bot's Blender bbox at 0.60 / 390×520 (391.2), then the gap table.
const ref=samples.find(s=>Math.abs(s.progress-.6)<1e-6);assert(ref,'p0.60 fixture');{const g=frame(ref,ref.check_W,ref.check_H,0).g;for(let i=0;i<4;i++)assert(Math.abs(g[i]-ref.check_bbox_pt[i])<0.6,'projection matches Blender '+g+' vs '+ref.check_bbox_pt)}
const table=[];
for(const [W,H]of screens){const deg=Y.dialogYieldPitchDeg(W,H),key=W+'x'+H;let worst=null,worstClosed=null;
  for(const s of samples){const o=frame(s,W,H,deg),c=frame(s,W,H,0);
    assert.deepEqual(o.pose.position,c.pose.position,'lens never moves');assert.equal(C.validateCameraPose(o.pose),null);
    assert(o.g[1]>=47&&o.g[0]>=0&&o.g[2]<=W,key+' she is cropped '+o.g);
    if(!worst||o.L.gap<worst.L.gap)worst=Object.assign(o,{progress:s.progress});if(!worstClosed||c.L.gap<worstClosed.L.gap)worstClosed=c;
    if(required.has(key)){assert(o.L.fit>=1,key+' p'+s.progress+' 1 line must fit, fit='+o.L.fit);assert(o.L.gap>=13-1e-9,key+' p'+s.progress+' gap '+o.L.gap.toFixed(1)+' <13 ('+o.L.by+')')}}
  // reference drop of the look target at the returnFollow distance (camera→target 2.43 m at 0.60)
  const d=Math.hypot(...sub(ref.camera.target,ref.camera.position)),fwd=sub(ref.camera.target,ref.camera.position),pitch0=Math.atan2(fwd[1],Math.hypot(fwd[0],fwd[2]));
  const drop=d*Math.cos(pitch0)*(Math.tan(-pitch0+deg*Math.PI/180)-Math.tan(-pitch0));
  table.push({screen:key,pitchDeg:+deg.toFixed(3),targetDropM:+drop.toFixed(3),closedLinesFit:worstClosed.L.fit,closedGapPt:+worstClosed.L.gap.toFixed(1),openLines:worst.L.lines,openFit:worst.L.fit,openGapPt:+worst.L.gap.toFixed(1),nearest:worst.L.by,worstProgress:worst.progress,girlBottomPt:+worst.g[3].toFixed(1),girlTopPt:+worst.g[1].toFixed(1)});}
for(const k of ['375x667','360x780','390x844','414x896','768x1024'])assert.equal(table.find(r=>r.screen===k).pitchDeg,0,k+' taller screens unchanged');
// 2) motion: 0.60 base pose, the full yield of 390×520. Track forward dir (angular) and the look point at camera→target distance (linear).
function simulate(fps,events,dur){const base=C.fromLookAt(ref.camera,60),deg=Y.dialogYieldPitchDeg(390,520),dist=Math.hypot(...sub(ref.camera.target,ref.camera.position)),m=Y.createYieldMotion(),dt=1/fps;
  const out=[];let goal=0,ei=0;for(let t=0;t<=dur+1e-9;t+=dt){while(ei<events.length&&events[ei][0]<=t+1e-9)goal=events[ei++][1];const x=Y.stepYieldMotion(m,goal,dt),p=Y.yieldPose(base,deg*x),f=C.rotate(p.rotation,[0,0,-1]);
    out.push({x,f,look:[p.position[0]+f[0]*dist,p.position[1]+f[1]*dist,p.position[2]+f[2]*dist],pos:p.position})}
  let wMax=0,aMax=0,vMax=0,linA=0,stepDeg=0,posMove=0;const ang=(a,b)=>Math.acos(Math.min(1,dot(a,b)))*180/Math.PI;
  const w=[];for(let i=1;i<out.length;i++){const a=ang(out[i-1].f,out[i].f);stepDeg=Math.max(stepDeg,a);w.push(Math.sign(out[i].x-out[i-1].x)*a/dt);posMove=Math.max(posMove,Math.hypot(...sub(out[i].pos,out[0].pos)))}
  for(let i=1;i<w.length;i++){wMax=Math.max(wMax,Math.abs(w[i]));aMax=Math.max(aMax,Math.abs(w[i]-w[i-1])/dt)}
  for(let i=1;i<out.length-1;i++){const acc=[0,1,2].map(k=>(out[i+1].look[k]-2*out[i].look[k]+out[i-1].look[k])/(dt*dt));linA=Math.max(linA,Math.hypot(...acc));
    vMax=Math.max(vMax,Math.hypot(...[0,1,2].map(k=>(out[i+1].look[k]-out[i-1].look[k])/(2*dt)))) }
  return {fps,peakAngVelDegS:+wMax.toFixed(2),peakAngAccDegS2:+aMax.toFixed(1),peakLookLinVelMS:+vMax.toFixed(3),peakLookLinAccMS2:+linA.toFixed(2),lensLinAccMS2:+posMove.toFixed(9),maxStepDegPerFrame:+stepDeg.toFixed(3),end:+out[out.length-1].x.toFixed(6)}}
const cases={'open→close':[[0,1],[1.2,0]],'close at 0.15 s (mid-open)':[[0,1],[0.15,0]],'close at 0.30 s':[[0,1],[0.3,0]],'reopen at 0.2 s into close':[[0,1],[0.8,0],[1.0,1],[2.2,0]],'toggle every 0.1 s':[[0,1],[0.1,0],[0.2,1],[0.3,0],[0.4,1],[0.5,0]]};
const motion=[];for(const name in cases)for(const fps of [30,60,120]){const r=simulate(fps,cases[name],3.5);r.case=name;motion.push(r);
  assert(r.peakAngAccDegS2<=120,name+' ang accel '+r.peakAngAccDegS2);assert(r.peakLookLinAccMS2<=3,name+' lin accel '+r.peakLookLinAccMS2);assert.equal(r.lensLinAccMS2,0,'lens fixed');
  assert(r.maxStepDegPerFrame*fps<=15,name+' jump '+r.maxStepDegPerFrame+'° in one frame @'+fps);assert.equal(r.end,0,name+' returns to 0')}
// the dialog hook exists and the camera post-pass is wired in the single camera writer path
Y.setDialogCameraOpen(true);assert.equal(Y.dialogCameraOpen(),true);Y.setDialogCameraOpen(false);
const wf=fs.readFileSync(path.join(src,'WorldFlowComponent.ts'),'utf8');assert(/applyDialogYield\(frameDt\)/.test(wf)&&/'dialog\.yield'/.test(wf),'WorldFlowComponent post-pass wired');
console.log(JSON.stringify({status:'PASS',params:Y.DIALOG_CAMERA_YIELD,samples:samples.map(s=>s.progress),table,motion},null,1));
