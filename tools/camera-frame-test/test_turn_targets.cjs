'use strict';
/** Turn targets taken from a path start/end use the first point >= 0.05 m away (WorldFlowCore.pathHeading), not path[1]:
 * toThreshold's first segment is 3 mm and points backward (old return turn target 32.6 deg -> 166 deg snap at walk start,
 * GGbot walk driver afb5d7b). Checks: pathHeading unit cases; every turn the REAL flow performs ends within 20 deg of the
 * heading of the walk that follows it (measured over that walk's first 0.3 m); no raw path[1]-path[0] heading left in source. */
const S=require('./flow_sim.cjs'),fs=require('fs'),path=require('path');let fail=0;
const check=(n,ok,info)=>{console.log((ok?'PASS ':'FAIL ')+n.padEnd(30),JSON.stringify(info));if(!ok)fail++;};
const deg=r=>r*180/Math.PI,wrap=a=>Math.atan2(Math.sin(a),Math.cos(a));
(async()=>{const env=S.create(),W=env.W,cfg=env.cfg;
  {const p=[[0,0,0],[0.002,0,-0.002],[0,0,1],[1,0,1]];const a=deg(W.pathHeading(p)),b=deg(W.pathHeading(p,true)),c=deg(W.pathHeading([[0,0,0],[0,0,.01]]));
    check('pathHeading-unit',Math.abs(a)<1e-6&&Math.abs(b-90)<1e-6&&Math.abs(c)<1e-6&&W.HEADING_MIN_DIST===0.05,{startDeg:a,endDeg:b,shortOnlyDeg:c,minDist:W.HEADING_MIN_DIST});}
  // flow: record actions through a wrapper around the sim character
  const run=await S.run(env);const A=run.actions;
  const head03=p=>{const o=p[0];let L=0;for(let i=1;i<p.length;i++){L+=Math.hypot(p[i][0]-p[i-1][0],p[i][2]-p[i-1][2]);if(L>=.3){const q=W.pointOnPath(p,.3);return Math.atan2(q[0]-o[0],q[2]-o[2]);}}const q=p[p.length-1];return Math.atan2(q[0]-o[0],q[2]-o[2]);};
  const res=[];for(let i=0;i<A.length;i++){const a=A[i];if(a.kind!=='turn')continue;const w=A.slice(i+1).find(x=>x.kind==='walk'||x.kind==='turn'||x.kind==='sit');if(!w||w.kind!=='walk')continue;
    res.push({toDeg:+deg(a.toYawRad).toFixed(1),walkHeadingDeg:+deg(head03(w.path)).toFixed(1),errDeg:+Math.abs(deg(wrap(head03(w.path)-a.toYawRad))).toFixed(1)});}
  check('turn-meets-next-walk',res.length>=2&&res.every(r=>r.errDeg<=20),{turnsFollowedByWalk:res});
  const rt=res.find(r=>Math.abs(r.walkHeadingDeg)>150);check('return-turn-not-3mm-segment',!!rt&&rt.errDeg<=20,{returnTurn:rt,toThresholdSeg0M:+Math.hypot(cfg.toThreshold[1][0]-cfg.toThreshold[0][0],cfg.toThreshold[1][2]-cfg.toThreshold[0][2]).toFixed(4)});
  const src=fs.readFileSync(path.join(__dirname,'../../creator-build-project/assets/scripts/world-r1/WorldFlowCore.ts'),'utf8');
  const raw=src.match(/atan2\(\s*c\.\w+\[1\]\[0\]-c\.\w+\[0\]\[0\]/g)||[];check('no-raw-path1-heading',raw.length===0,{matches:raw});
  console.log(fail?'FAILED':'ALL PASS turn-targets');process.exit(fail?1:0);})();
