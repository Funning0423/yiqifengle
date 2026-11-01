'use strict';
/** Export the real TS WorldFlow + character driver and current GLB at fixed frame steps.
 * Node FK/state adapters, NOT Cocos rendering. These sampled TRS/morph values, rather than guessed clip joins,
 * can drive a continuous Blender review. QF_TYPESCRIPT_MODULE required; WALK_GLB selects a candidate with adjacent anim_meta.
 * node tools/walk-driver/export_motion_replay.cjs --out /absolute/path/replay.json [--fps 60] */
const fs=require('fs'),path=require('path'),crypto=require('crypto'),S=require('../camera-frame-test/flow_sim.cjs');
const ROOT=path.resolve(__dirname,'../..'),args=process.argv.slice(2),arg=n=>args.includes(n)?args[args.indexOf(n)+1]:null;
const out=arg('--out');if(!out)throw Error('--out is required');const fps=Number(arg('--fps')||60);if(!(fps>0&&fps<=240))throw Error('fps must be 1..240');
process.env.QF_REAL_WALK_REST='1';
const hash=f=>crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');
(async()=>{const env=S.create({realWalk:true});env.captureCharacter=true;const run=await S.run(env,{fps});const glb=process.env.WALK_GLB||path.join(ROOT,'creator-build-project/assets/bundles/region_island/character/chr_b_r5g2_lod0_anim_pass2_INTERIM_s1_grokbot2.glb'),meta=path.join(path.dirname(glb),'anim_meta.json');
 const bytes=fs.readFileSync(glb),json=JSON.parse(bytes.subarray(20,20+bytes.readUInt32LE(12)).toString()),joints=json.skins[0].joints.map(i=>json.nodes[i].name);
 const sources=['creator-build-project/assets/scripts/CharacterMotion.ts','creator-build-project/assets/scripts/WorldIntegrationBoot.ts','creator-build-project/assets/scripts/world-r1/WorldFlowCore.ts','creator-build-project/assets/scripts/world-r1/FirstsliceRoutes.ts','tools/walk-driver/glb_rig.cjs'];
 const frames=run.frames.map(f=>{const d=f.character.diagnostics;return {frame:f.frame,t:f.t,op:f.op,state:f.state,controllerRoot:f.root,yawRad:f.yaw,doorAngleDeg:f.door,camera:f.cam,layers:f.layers,wind:f.wind,clip:d.clip,clipTime:d.time,action:d.action,fade:d.motion.fade,morphWeights:d.motion.morph.weights||{},morphMeshes:f.character.morph,nodes:f.character.nodes};});
 const report={schema:'qifengle-motion-replay/v1',scope:'Actual TS flow/driver + current GLB sampled with Node structural scene adapters and glb_rig FK; not actual Cocos runtime or visual acceptance.',units:'m',up:'+Y',forward:'+Z',controllerOwnsWorldMotion:true,fps,dt:run.dt,glb:path.resolve(glb),glbSHA256:hash(glb),animMeta:path.resolve(meta),animMetaSHA256:hash(meta),sourceSHA256:Object.fromEntries(sources.map(f=>[f,hash(path.join(ROOT,f))])),joints,door:env.M.FirstsliceFacts.FIRSTSLICE.door,doorClosedHandle:env.M.FirstsliceFacts.FIRSTSLICE.anchors.door_handle.position,results:run.results,states:run.states,frames};
 fs.mkdirSync(path.dirname(path.resolve(out)),{recursive:true});fs.writeFileSync(out,JSON.stringify(report));console.log(JSON.stringify({out:path.resolve(out),frames:frames.length,joints:joints.length,seconds:frames.at(-1).t,bytes:fs.statSync(out).size,results:report.results}));
})().catch(e=>{console.error(e.stack||e);process.exitCode=1;});
