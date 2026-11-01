#!/usr/bin/env node
// 场景特效bot r5 S3: run 运镜bot's free_cam_audit.cjs against THIS worktree and dump
// every 'under' ray (upward ray that ends on the top face of a GROUND mesh) as JSONL,
// the input of lakeside_under_seal.cjs.
//
// The audit lives on 运镜bot's branch (tools/camera-frame-test/free_cam_audit.cjs) and
// resolves BUNDLES from its own __dirname, so it is compiled here under a filename
// inside this repo; the only change is a hook after the per-pivot ray loop. Nothing
// is written into the tree. The audit's own args pass through (--only, --out, --json).
//
//   node tools/scene-fx/free_cam_under_hits.cjs --only lakeside --hits /tmp/hits.jsonl \
//        --out /tmp/fca --json /tmp/fca.json [--audit <path to free_cam_audit.cjs>]
//
// Each line: {a, p, pv, cam, dUse, under:[{d, t, name, hit}]} for pivots with >= 1 under ray.
// After the run it prints, per region: status counts, under rays, underFrac sum, void, back.
'use strict';
const fs=require('fs'),path=require('path'),Module=require('module');
const arg=(k,d)=>{const i=process.argv.indexOf(k);return i>0?process.argv[i+1]:d;};
const ROOT=path.resolve(__dirname,'../..');
const AUDIT=arg('--audit',process.env.FREE_CAM_AUDIT||'/workspace/yiqifengle/work/运镜bot-freecam/tools/camera-frame-test/free_cam_audit.cjs');
const HITS=arg('--hits',null),JSON_OUT=arg('--json',null);
if(!HITS||!JSON_OUT){console.error('need --hits <out.jsonl> and --json <audit.json>');process.exit(2);}
let src=fs.readFileSync(AUDIT,'utf8');
const ANCHOR="if(h.under)underN++;}else if(d[1]<-0.03)voidN++;}";
const at=src.indexOf(ANCHOR);
if(at<0||src.indexOf(ANCHOR,at+1)>=0){console.error('free_cam_audit.cjs changed: ray-loop anchor not found exactly once in '+AUDIT);process.exit(3);}
const HOOK="if(underN>0){require('fs').appendFileSync("+JSON.stringify(HITS)+",JSON.stringify({a,p,pv:pv.id,cam,dUse,under:RR.map(d=>{const h=I.ray(cam,d,400,1);return h&&h.under?{d,t:h.t,name:h.name,hit:[cam[0]+d[0]*h.t,cam[1]+d[1]*h.t,cam[2]+d[2]*h.t]}:null;}).filter(Boolean)})+'\\n');}";
src=src.slice(0,at+ANCHOR.length)+HOOK+src.slice(at+ANCHOR.length);
src=src.replace(/^#!.*\n/,'');
if(fs.existsSync(HITS))fs.unlinkSync(HITS);
process.on('exit',code=>{
  if(code||!fs.existsSync(JSON_OUT))return;
  const R=JSON.parse(fs.readFileSync(JSON_OUT,'utf8')).regions||{};
  const hits=fs.existsSync(HITS)?fs.readFileSync(HITS,'utf8').trim().split('\n').filter(Boolean).map(l=>JSON.parse(l)):[];
  Object.keys(R).forEach(k=>{
    const cells=((R[k].result||{}).cells)||[],per=[];cells.forEach(c=>(c.per||[]).forEach(q=>per.push(q)));
    if(!per.length)return;const st={};let u=0,v=0,b=0;
    per.forEach(q=>{st[q.status]=(st[q.status]||0)+1;u+=q.underFrac||0;v+=q.voidFrac||0;b+=q.backFrac||0;});
    console.log('UNDERHITS '+k+' status '+JSON.stringify(st)+' underSum '+u.toFixed(3)+' void '+v.toFixed(3)+' back '+b.toFixed(3));
  });
  console.log('UNDERHITS rays '+hits.reduce((s,h)=>s+h.under.length,0)+' in '+hits.length+' pivots -> '+HITS);
});
const fake=path.join(ROOT,'tools/camera-frame-test/free_cam_audit.cjs');
const m=new Module(fake,module);m.filename=fake;m.paths=Module._nodeModulePaths(path.dirname(fake));
m._compile(src,fake);
