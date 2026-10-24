'use strict';
/* p0d5sky (Mac r16d ?qfSkip=skycity-finale): explore opened with her at walk-local (-18.05,1.02,56.79), 12.6 m off the plateau,
 * camera on her hat → every ground ray kind=none. B1: from that spot no downward ray reaches the walkable grid (the Mac symptom).
 * B2: standOnWalk stands her on the nearest skycity node (model far off the origin, toWorld), then taps from the follow lens hit walk.
 * B3: on the plateau standOnWalk leaves her alone. B4: qaTeleport('S3') stands her on S3 and re-seeds the lens round her; bad key / closed explore refused. */
const assert=require('node:assert/strict');
const {RW,RN,E,rig}=require('./explore-stage-harness.cjs');
const AT=[-150,24,236],S3=RN.REGION_NODES.skycity.nodes.find(n=>n.key==='S3').at;
const mk=()=>({m12:AT[0],m13:AT[1],m14:AT[2],clone(){return {...this};}});
function setup(local){const R=rig('skycity','S1',[local[0]+AT[0],local[1]+AT[1],local[2]+AT[2]],{modelAt:AT});let her=R.her();
 R.st.model=()=>({worldMatrix:mk(),activeInHierarchy:true,getComponentsInChildren:()=>[]});R.st.girl=()=>her;
 R.st.character={cancelAndReset:o=>{her=o.controllerRoot.slice();}};return {R,her:()=>her};}
const loc=h=>[h[0]-AT[0],h[1]-AT[1],h[2]-AT[2]];
const rays=o=>{let walk=0;for(let a=0;a<360;a+=15)for(const dn of [0.3,0.6,1,2]){const r=a*Math.PI/180;if(RW.walkRayHit('skycity',o,[Math.sin(r),-dn,Math.cos(r)]).kind==='walk')walk++;}return walk;};
// B1
const bad=[-18.05,1.02,56.79];{const n=rays([bad[0],bad[1]+1.7,bad[2]]);/* p0drag7 merge: skycity-walk-r2 WALK_TAP_SNAP lets a few rays (5/96) that clip a wall snap to floor; the symptom (almost every tap none) still holds */
 assert.ok(n<=8,'B1 Mac symptom reproduced '+n);}
// B2
{const {R,her}=setup(bad);R.st.standOnWalkOrThrow('skycity');const l=loc(her());assert.ok(RW.nearestWalkable('skycity',l,0.6),'B2 on walkable '+l);
 const p=E.followPose(her(),0,390,844,0);assert.ok(rays(p.position.map((v,i)=>v-AT[i]))>0,'B2 taps hit walk');console.log('B2 stood at',l.map(v=>+v.toFixed(2)));}
// B3
{const on=[S3[0]+0.5,S3[1],S3[2]];const {R,her}=setup(on);R.st.standOnWalkOrThrow('skycity');assert.deepEqual(loc(her()).map(v=>+v.toFixed(3)),on.map(v=>+v.toFixed(3)),'B3 untouched');}
// B4
{const {R,her}=setup(bad);R.st.exploring=true;const r=R.st.qaTeleport('S3');assert.equal(r.ok,true);assert.ok(Math.hypot(loc(her())[0]-S3[0],loc(her())[2]-S3[2])<1e-6,'B4 at S3');
 const c=R.cam(),h=her();assert.ok(Math.hypot(c.position[0]-h[0],c.position[2]-h[2])<16,'B4 lens round her');
 assert.equal(R.st.qaTeleport('X9').ok,false);R.st.exploring=false;assert.equal(R.st.qaTeleport('S3').reason,'explore-not-open');}
console.log('skycity-stand OK');
