'use strict';
/* board-kit-camera (P0): the kit camera interface = camera_per_aspect + WorldFlowComponent.setEnterLevelEnd hook.
 * - BoardKit never writes the camera (no setCamera / applyCameraPose / node transform / fov writes in BoardKit.ts).
 * - kitBoardPose(COAST_KIT) reproduces every screen's camera from the PLACEHOLDER fixture (运镜bot tiles.json, not final):
 *   position ≤ 1 mm, same quaternion and vertical FOV 50 on all 7 screens; only the distance along the view line differs.
 * - kitTileWorld reproduces the 49 tile centres (D3); kitProject reproduces the fixture's 49 projected centres ≤ 0.1 pt per screen.
 * - topNoGo (top info-board avoidance) holds one range per screen = level plate + hint banner (BoardLayout). Overlap of the projected
 *   board with it is REPORTED (open item for Grok Bot) until the distances are final, then it becomes a gate. */
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');const {createHarness}=require('./harness.cjs');const H=createHarness();
const K=H.load('ui/BoardKit'),L=H.load('ui/BoardLayout'),F=require('./fixtures/coast-tiles.placeholder.json');
const src=fs.readFileSync(path.join(H.SCRIPTS||path.resolve(__dirname,'../../creator-build-project/assets/scripts'),'ui/BoardKit.ts'),'utf8').replace(/\/\*[\s\S]*?\*\//g,'').replace(/\/\/.*$/gm,'');
assert.ok(!/setCamera|applyCameraPose|setEnterLevelEnd\s*\(|\.setPosition|\.setRotation|worldCamera|\.fov\s*=|\.camera\s*=/.test(src),'BoardKit.ts must never write the camera');
const kit=K.COAST_KIT,cam=kit.camera;assert.equal(cam.placeholder,true);assert.match(cam.source,/unsigned/);assert.match(F._PLACEHOLDER,/NOT final/);
const SC=Object.keys(F.camera_per_aspect.screens);assert.equal(SC.length,7);
let worst=0,report=[];
for(const k of SC){const [w,h]=k.split('x').map(Number),fx=F.camera_per_aspect.screens[k],pose=K.kitBoardPose(cam,w,h);
 assert.equal(pose.distanceM,fx.distance_m,k+' distance (placeholder)');assert.deepEqual(pose.rotationXYZW,fx.quat_island_world_xyzw,k+' quaternion');assert.equal(pose.fovVerticalDeg,fx.fov_vertical_deg);
 pose.position.forEach((x,i)=>assert.ok(Math.abs(x-fx.position_island_world[i])<1e-3,k+' position '+pose.position+' vs '+fx.position_island_world));
 for(let i=0;i<49;i++){const t=F.tiles[i],wp=K.kitTileWorld(kit,i);wp.forEach((x,j)=>assert.ok(Math.abs(x-(t.centre_island_world[j]+(j===1?0.02:0)))<1e-9,'tile '+i+' world'));/* tiles.json centre y 0.1 = slab body; projection plane = slab top 0.12 */
  const p=K.kitProject(pose,w,h,wp),q=fx.cell_centres_pt[i];assert.ok(p,'tile behind camera');const e=Math.hypot(p.x-q[0],p.y-q[1]);worst=Math.max(worst,e);assert.ok(e<=0.1,k+' tile '+i+' projected '+p.x.toFixed(1)+','+p.y.toFixed(1)+' vs '+q);}
 const s=L.boardSafeInsets(w,h),l=L.boardLayout(w,h,s),ng=kit.topNoGo[k];assert.ok(ng,k+' topNoGo');assert.ok(Math.abs(ng[1]-(l.toast.y+l.toast.height/2))<0.1,k+' topNoGo bottom ≠ plate+hint bottom');
 const rimTop=Math.min(...[0,1,2,3,4,5,6].map(c=>K.kitProject(pose,w,h,[kit.board.anchor[0]-(c-3),kit.board.anchor[1]+0.15,kit.board.anchor[2]+3.95]).y));
 if(rimTop<ng[1])report.push(`${k}: rim top y ${rimTop.toFixed(1)} < no-go bottom ${ng[1]} (overlap ${(ng[1]-rimTop).toFixed(1)} pt)`);}
console.log(`ok   7 screens: pose = fixture (quat/FOV identical, distance only), 49 tiles world exact, projection (slab top 0.12) worst ${worst.toFixed(3)} pt`);
console.log('ok   BoardKit.ts writes no camera (setEnterLevelEnd provider only)');
for(const r of report)console.log('     REPORT top info-board overlap (placeholder distances, open item for Grok Bot): '+r);
console.log('board-kit-camera: PASS'+(report.length?` (${report.length} screens overlap the top info board: REPORT until distances are final)`:''));
