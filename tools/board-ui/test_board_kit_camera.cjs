'use strict';
/* board-kit-camera (P0 + P1): the kit camera interface = camera_per_aspect + WorldFlowComponent.setEnterLevelEnd hook.
 * - BoardKit.ts / BoardProjection.ts never write the camera (no setCamera / applyCameraPose / node transform / fov writes).
 * - kitBoardPose(COAST_KIT) reproduces every screen's camera from the PLACEHOLDER fixture (运镜bot tiles.json, not final):
 *   position ≤ 1 mm, same quaternion and vertical FOV 50 on all 7 screens; only the distance along the view line differs.
 * - look-at offset (P1 note 1): parameter only, default 0 = the fixture pose; an offset moves the look-at along the ground only
 *   (y, quaternion, FOV unchanged).
 * - kitTileWorld reproduces the 49 tile centres (D3); kitProject reproduces the fixture's 49 projected centres ≤ 0.1 pt per screen.
 * - HUD limits come from the kit's per-variant data (normal = BoardLayout plate+hint bottom / tool tap top; compact = pending candidate).
 * - Edge rule (P1 note 2, replaces the whole-frame margin): every playable tile ≥ 8 pt from all four edges; the rim may bleed off
 *   left/right only, symmetric (≤ 0.5 pt), on its straight sides, clear of the HUD; rim top ≥ HUD top + 8, rim bottom ≤ HUD bottom − 8.
 *   With placeholder distances the violations are REPORTED (open item); once camera.placeholder is false they FAIL.
 *   Self-checks: a too-close camera (tiles at the edge), a shifted rim (asymmetric bleed) and a corner cut must each be detected. */
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');const {createHarness}=require('./harness.cjs');const H=createHarness();
const K=H.load('ui/BoardKit'),B=H.load('ui/BoardProjection'),L=H.load('ui/BoardLayout'),F=require('./fixtures/coast-tiles.final.json')/* 运镜bot final r2 tiles.json (team/cinematic/outbox/20261030-coast-board-lens) */,E=require('./coast-board-eval.cjs');
const SRC=path.resolve(__dirname,'../../creator-build-project/assets/scripts/ui');
for(const f of ['BoardKit.ts','BoardProjection.ts']){const src=fs.readFileSync(path.join(SRC,f),'utf8').replace(/\/\*[\s\S]*?\*\//g,'').replace(/\/\/.*$/gm,'');
 assert.ok(!/setCamera|applyCameraPose|setEnterLevelEnd\s*\(|\.setPosition|\.setRotation|worldCamera|\.fov\s*=|\.camera\s*=/.test(src),f+' must never write the camera');}
const kit=K.COAST_KIT,cam=kit.camera;assert.equal(cam.placeholder,false);assert.match(cam.source,/final/);assert.equal(cam.finalAspects.length,7,'all 7 screens final');
assert.equal(cam.lookAtOffsetM||0,0,'look-at offset default must be 0');
const SC=Object.keys(F.camera_per_aspect.screens);assert.equal(SC.length,7);
let worst=0;const report=[],fail=[],rows=[];
function edgeGate(kit){const rep=[],fl=[];for(const k of SC){const [w,h]=k.split('x').map(Number),e=B.edgeReport(B.projectBoard(kit,w,h),B.kitHudLimits(kit,w,h));
  if(e.problems.length)(kit.camera.finalAspects.includes(k)?fl:rep).push(k+': '+e.problems.join('; '));}return {rep,fl};}
for(const k of SC){const [w,h]=k.split('x').map(Number),fx=F.camera_per_aspect.screens[k],pose=K.kitBoardPose(cam,w,h);
 assert.equal(pose.distanceM,fx.distance_m,k+' distance (运镜bot final)');assert.deepEqual(pose.rotationXYZW,fx.quat_island_world_xyzw,k+' quaternion');assert.equal(pose.fovVerticalDeg,fx.fov_vertical_deg);
 pose.position.forEach((x,i)=>assert.ok(Math.abs(x-fx.position_island_world[i])<1e-3,k+' position '+pose.position+' vs '+fx.position_island_world));
 const p0=K.kitBoardPose(cam,w,h,{lookAtOffsetM:0});assert.deepEqual(p0,pose,'offset 0 must equal the default pose');
 const p1=K.kitBoardPose(cam,w,h,{lookAtOffsetM:1});assert.deepEqual(p1.rotationXYZW,pose.rotationXYZW);assert.equal(p1.fovVerticalDeg,50);assert.ok(Math.abs(p1.position[1]-pose.position[1])<1e-9,'offset must stay on the ground plane');
 assert.ok(Math.abs(Math.hypot(p1.position[0]-pose.position[0],p1.position[2]-pose.position[2])-1)<1e-9,'offset 1 m along the ground');
 for(let i=0;i<49;i++){const t=F.tiles[i],wp=K.kitTileWorld(kit,i);wp.forEach((x,j)=>assert.ok(Math.abs(x-(t.centre_island_world[j]+(j===1?0.02:0)))<1e-9,'tile '+i+' world'));
  const p=K.kitProject(pose,w,h,wp);assert.ok(p,'tile behind camera');if(!fx.cell_centres_pt)continue;const q=fx.cell_centres_pt[i],e=Math.hypot(p.x-q[0],p.y-q[1]);worst=Math.max(worst,e);assert.ok(e<=0.1,k+' tile '+i+' projected');}
 // HUD limits: normal variant = BoardLayout numbers (data, not hard-coded in code); legacy topNoGo agrees
 const s=L.boardSafeInsets(w,h),l=L.boardLayout(w,h,s),nh=B.kitHudLimits(kit,w,h,'normal'),hud=B.kitHudLimits(kit,w,h);assert.equal(nh.variant,'normal');
 assert.ok(Math.abs(nh.top-(l.toast.y+l.toast.height/2))<0.1,k+' normal HUD top ≠ plate+hint bottom');assert.ok(Math.abs(nh.bottom-(l.tools.y-l.tools.hit/2))<0.1,k+' normal HUD bottom ≠ tool tap top');
 assert.equal(kit.topNoGo[k][1],nh.top);assert.equal(hud.variant,h<=600?'compact':'normal',k+' selected HUD');assert.equal(hud.variant,{current:'normal',compact:'compact'}[fx.hud],k+' HUD variant = 运镜bot');assert.deepEqual([hud.top,hud.bottom],[fx.keepout_pt.top,fx.keepout_pt.tool_top],k+' keep-out = 运镜bot');
 const c=B.kitHudLimits(kit,w,h,'compact');assert.equal(c.variant,h<=600&&w<h*1.1?'compact':'normal',k+' compact trigger');
 const b=B.projectBoard(kit,w,h),e=B.edgeReport(b,hud);
 rows.push(`${k}: tiles ≥ ${e.tileMin.toFixed(1)} pt from edge · rim bleed L ${e.bleedL.toFixed(1)} / R ${e.bleedR.toFixed(1)} (asym ${e.asym.toFixed(2)}) · rim y ${e.rimTop.toFixed(1)}–${e.rimBottom.toFixed(1)} vs HUD ${hud.top}–${hud.bottom}`);
 void e;}
{const g=edgeGate(kit);report.push(...g.rep);fail.push(...g.fl);}
// self-check: the FAIL switch is data (camera.finalAspects): a final screen with a bad pose must FAIL, the same pose unmarked only REPORTs
{const bad={...kit,camera:{...cam,finalAspects:[],distanceByAspect:{...cam.distanceByAspect,'320x568':13}}};assert.equal(edgeGate(bad).fl.length,0);assert.ok(edgeGate(bad).rep.some(r=>/^320x568/.test(r)),'self-check: bad pose not reported');
 const fin={...bad,camera:{...bad.camera,finalAspects:['320x568']}};assert.ok(edgeGate(fin).fl.some(r=>/^320x568/.test(r)),'self-check: finalAspects did not switch the check to FAIL');console.log('ok   self-check: info-board overlap on a finalAspects screen FAILs, unmarked only REPORTs');}
// self-checks: the edge rule sees each violation
{const b=B.projectBoard(kit,390,844,{distanceM:12}),e=B.edgeReport(b,B.kitHudLimits(kit,390,844));assert.ok(e.tileMin<8&&e.problems.some(p=>/tile/.test(p)),'self-check: tiles at the edge not detected');}
{const b=B.projectBoard(kit,320,568,{distanceM:15.97});const sh={...b,rim:b.rim.map(p=>({...p,x:p.x+6}))},e=B.edgeReport(sh,{variant:'x',pending:false,top:0,bottom:568});assert.ok(e.problems.some(p=>/asymmetric/.test(p)),'self-check: asymmetric bleed not detected');}
{const b=B.projectBoard(kit,320,568,{distanceM:12.5}),e=B.edgeReport(b,{variant:'x',pending:false,top:0,bottom:568});assert.ok(e.cutOnCorner,'self-check: corner cut not detected');}
console.log(`ok   finalAspects = [${cam.finalAspects.join(',')}]; 7 screens: pose = fixture (运镜bot final r2) (quat/FOV identical, distance only), look-at offset 0 = fixture, offset moves along the ground only; 49 tiles world exact, projection worst ${worst.toFixed(3)} pt`);
console.log('ok   BoardKit.ts / BoardProjection.ts write no camera (setEnterLevelEnd provider only)');
console.log('ok   self-checks: tiles at the edge, asymmetric bleed, corner cut each detected');
for(const r of rows)console.log('     EDGE '+r);
// decision data: feasible distance per HUD variant (offset 0 and the best ground offset in [-1.5, 1.5] m)
for(const [w,h] of E.SCREENS)for(const v of ['normal','compact']){if(v==='compact'&&!(h<=600))continue;const f0=E.feasible(K,B,kit,w,h,v,0);
 let bo=null;if(!f0.lo||h<=600)for(let o=-1.5;o<=1.5001;o+=0.25){const f=E.feasible(K,B,kit,w,h,v,o);if(f&&f.lo&&(!bo||f.best.far>bo.f.best.far))bo={o,f};}
 const fmt=f=>f&&f.lo?`D ${f.lo.toFixed(2)}–${f.hi.toFixed(2)} m (at ${f.lo.toFixed(2)}: far ${f.best.far.toFixed(1)} pt, tiles ${f.best.e.tileMin.toFixed(1)} pt, bleed ${f.best.e.bleedL.toFixed(1)}/${f.best.e.bleedR.toFixed(1)})`:'NO distance satisfies edge rule + far ≥ 28';
 console.log(`     SOLVE ${w}x${h} ${v}: offset 0 → ${fmt(f0)}`+(bo?` · best offset ${bo.o.toFixed(2)} m → ${fmt(bo.f)}`:(!f0.lo||h<=600?' · look-at offset −1.5…+1.5 m: none works':'')));}
for(const r of report)console.log('     REPORT edge rule (screen not final): '+r);
for(const r of fail)console.log('     FAIL edge rule: '+r);
if(fail.length){console.log('board-kit-camera: FAIL');process.exit(1);}
console.log('board-kit-camera: PASS'+(report.length?` (${report.length} screens break the edge rule with placeholder distances: REPORT until distances are final)`:''));
