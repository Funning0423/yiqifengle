'use strict';
/** locomotion-v1 driver tests (GGbot), loaded by test_walk_driver.cjs (same REAL FlowReferenceStandin / CharacterMotion).
 * Clips: env LOCO_GLB (default: the committed character GLB + anim_meta.json in region_island/character, 角色动画bot d0760ce).
 * Without that GLB the clip-level checks are SKIPPED (reported) and only the synthetic-curve checks run.
 *  - root_motion parsing (preview schema), planWalk on synthetic curves (continuity, exact end, phase lands on the heel strike)
 *  - foot slide (planted ankle drift) from rest -> walk_start -> walk_loop -> stop -> idle, curves vs the old constant root
 *  - stop variant = the walk_loop heel strike at the entry distance (both variants over a sweep of lengths), entry in-frame
 *  - one contact = one footstep (entry_contact / same-contact dedupe), settle type passed through
 *  - 180 L/R selection (chooseTurn) + full out-and-back flow with the route rest predicate */
const CHAR=require('path').resolve(__dirname,'..','..','creator-build-project/assets/bundles/region_island/character')+'/';
let H=null;function install(h){H=h;}
const clone=o=>JSON.parse(JSON.stringify(o));
function stripRoot(meta){const m=clone(meta);for(const k in m.clips)if(m.clips[k]&&typeof m.clips[k].root_motion==='object')delete m.clips[k].root_motion;return m;}
/** Planted-ankle drift: per foot bone, stance = ankle world height within STANCE_MM of that bone's minimum over the run;
 *  drift = max horizontal distance from the window's first frame (mm). Windows shorter than 4 frames ignored. */
const STANCE_MM=6;
function slideOf(samples){const out={},byClip={};out.byClip=byClip;for(const bone of ['foot.L','foot.R']){const ys=samples.map(s=>s[bone][1]);const ymin=Math.min(...ys);let win=null,worst={mm:0,where:null},n=0;const all=[];
  const close=()=>{if(win&&win.frames>=4){n++;all.push(win.max);const k=win.label.split('@')[0];byClip[k]=Math.max(byClip[k]||0,+win.max.toFixed(2));if(win.max>worst.mm)worst={mm:win.max,where:win.label};}win=null;};
  for(const s of samples){const p=s[bone];if(p[1]<ymin+STANCE_MM/1000){if(!win)win={start:p,max:0,frames:0,label:s.label+'@'+s.t.toFixed(2)};win.frames++;win.max=Math.max(win.max,Math.hypot(p[0]-win.start[0],p[2]-win.start[2])*1000);}else close();}
  close();out[bone]={worstMm:+worst.mm.toFixed(2),where:worst.where,windows:n};}
  return out;}
async function straightRun(meta,o){const {makeCharacter,Token,flush,foot}=H;const c=makeCharacter({glb:o.glb,meta});c.s.cancelAndReset({kind:'standing',controllerRoot:[0,0,0],yawRad:0});
  for(let i=0;i<20;i++)c.s.advance(1/60);const L=o.L,dur=o.dur||L/0.7;const fe=[],samples=[],clips=[];let t=0;c.s.onFoot(e=>fe.push(Object.assign({t},e)));
  const p=c.s.perform(Object.assign({kind:'walk',path:[[0,0,0],[0,0,L]],duration:dur},o.stopAtEnd===undefined?{}:{stopAtEnd:o.stopAtEnd}),new Token());let done=false;p.then(()=>{done=true;});
  const plan=c.s.diagnostics().motion.walkPlan;
  const hz=o.hz||60;for(let i=0;i<Math.ceil((dur+(o.tail||2))*hz);i++){t+=1/hz;c.s.advance(1/hz);await flush();const d=c.s.diagnostics();clips.push(d.clip);
    samples.push({t,label:d.clip,'foot.L':foot(c,'foot.L'),'foot.R':foot(c,'foot.R'),z:c.node.worldPosition.z,x:c.node.worldPosition.x,wp:c.s.walkProgress(),done});}
  await p;return {c,fe,samples,clips,plan,end:c.node.worldPosition,events:c.s.diagnostics().events,motion:c.s.diagnostics().motion};}
async function run(){const {check,motion,assert,fs,makeCharacter,Token,flush,flowRun,deg}=H;
  const glb=process.env.LOCO_GLB||CHAR+'chr_b_r5g2_lod0_anim_pass2_INTERIM_s1_grokbot2.glb',mp=require('path').join(require('path').dirname(glb),'anim_meta.json');
  const have=fs.existsSync(glb)&&fs.existsSync(mp);const META=have?JSON.parse(fs.readFileSync(mp,'utf8')):JSON.parse(fs.readFileSync(CHAR+'anim_meta.json','utf8'));
  // ---------- parsing (preview schema) ----------
  check('loco: anim_meta locomotion-v1 parsing (root_motion curves, walk_loop string root_motion ignored, entry, entry_contact/type, handoff crossfade_s, turn_deg)',()=>{const cfg=motion.parseAnimMeta(META);
    const ws=cfg.clips.walk_start,sl=cfg.clips.walk_stop_bodyL,sr=cfg.clips.walk_stop_bodyR,t180=cfg.clips.walk_turn_180;
    assert.equal(cfg.clips.walk_loop.root,undefined);assert(ws.root.forward.length>=40);assert(Math.abs(ws.root.forward[ws.root.forward.length-1][1]-.847)<1e-6);
    assert.equal(ws.handoff.crossfade,0);assert.equal(ws.handoff.at,1.5);assert.equal(ws.handoff.nextTime,0.2);
    assert(sl.root.forward&&sl.root.lateral);assert.equal(sl.entry.walkTime,0);assert.equal(sr.entry.walkTime,0.566667);assert.equal(sl.entry.crossfade,0);
    assert.equal(sl.events[0].entryContact,true);assert.equal(sl.events[0].type,'heel_strike');assert.equal(sl.events[2].type,'settle');assert(/^settle:/.test(sl.events[2].name),'settle step named settle:* '+sl.events[2].name);assert.equal(t180.turnDeg,180);
    const st=motion.curveSettleTime(sl.root.forward);assert(Math.abs(st-.6667)<.03,'stop forward settles at '+st);
    return {walkStartKeys:ws.root.forward.length,stopForwardM:sl.root.forward[sl.root.forward.length-1][1],stopSettleS:+st.toFixed(4),stopLateralM:[sl.root.lateral[sl.root.lateral.length-1][1],sr.root.lateral[sr.root.lateral.length-1][1]],extraSecondsStartStop:+motion.walkProfileExtraSeconds(cfg,true,true).toFixed(3)};});
  // ---------- planWalk on synthetic curves ----------
  check('loco: planWalk synthetic curves (smoothstep start 1.5 s / 0.6 m, quadratic stop 0.25 m / 0.7 s): s(0)=0, s(D)=L, monotone, C0 + bounded speed steps, entry phase ON the heel strike',()=>{
    const fwdStart=[],fwdStop=[];for(let i=0;i<=60;i++){const t=i*2/60;fwdStart.push([t,t<=1.2?0.7*t*t/2.4:0.42+0.7*(t-1.2)]);}for(let i=0;i<=45;i++){const t=i/30;const u=Math.min(t,.7142857);fwdStop.push([t,0.7*u-0.49*u*u]);}
    const stops=[{clip:'walk_stop_bodyL',entryTime:0,body:'L',forward:fwdStop,lateral:null,S:fwdStop[45][1],T:motion.curveSettleTime(fwdStop),v1:motion.curveSlope(fwdStop,0),crossfade:0},
                 {clip:'walk_stop_bodyR',entryTime:.566667,body:'R',forward:fwdStop,lateral:null,S:fwdStop[45][1],T:motion.curveSettleTime(fwdStop),v1:motion.curveSlope(fwdStop,0),crossfade:0}];
    // durations per the WALK-DURATION CONTRACT with the profile allowance (walkProfileExtraSeconds for these curves)
    const extra=(1.5-motion.piecewise(fwdStart,1.5)/0.7)+(motion.curveSettleTime(fwdStop)-fwdStop[45][1]/0.7);
    const out=[];for(const L of [3,3.2,3.4,4.198,6]){const D=L/0.7+extra;const p=motion.planWalk({L,D,start:{clip:'walk_start',forward:fwdStart,at:1.5,nextTime:0.2,crossfade:0},stops,walkCycle:1.133333,native:0.7,phase0:null,v0:null});
      assert(p.start&&p.stop,'start+stop planned for '+L+' '+p.notes.join(';'));let prev=0,maxStepV=0,prevV=null;
      for(let i=1;i<=Math.ceil(D*240);i++){const t=Math.min(D,i/240),s=motion.walkDistanceAt(p,t);assert(s>=prev-1e-9,'monotone');const v=(s-prev)*240;if(prevV!==null)maxStepV=Math.max(maxStepV,Math.abs(v-prevV));prevV=v;prev=s;}
      assert(Math.abs(motion.walkDistanceAt(p,D)-L)<1e-9);assert(maxStepV<0.05,'speed step '+maxStepV);
      const u=p.start.nextTime+(p.stop.sEntry-p.start.S)/0.7*p.rate;const C=1.133333;let r=((u-p.stop.entryTime)%C+C)%C;if(r>C/2)r-=C;assert(Math.abs(r)<1e-9,'phase at entry '+r);assert(Math.abs(p.rate-1)<=motion.STOP_WARP_MAX+1e-12);
      out.push({L,stop:p.stop.clip,warp:+(p.rate-1).toFixed(5),cruise:+p.cruise.vc.toFixed(4),maxSpeedStepPer240Hz:+maxStepV.toFixed(4)});}
    const lin=motion.planWalk({L:4,D:4/0.7,start:null,stops:[],walkCycle:1.133333,native:.7,phase0:.3,v0:null});assert(lin.linear);for(const t of [0.1,1,3.3])assert.equal(motion.walkDistanceAt(lin,t),4*t/(4/0.7));
    const short=motion.planWalk({L:1,D:1/0.7,start:{clip:'walk_start',forward:fwdStart,at:1.5,nextTime:.2,crossfade:0},stops,walkCycle:1.133333,native:.7,phase0:null,v0:null});assert(short.linear&&!short.start&&!short.stop,'1 m walk falls back');
    // no allowance on a short walk: slow start + stop would need a cruise > 1.3 x native -> graceful fallback, never a bad plan
    const tight=motion.planWalk({L:3,D:3/0.7,start:{clip:'walk_start',forward:fwdStart,at:1.5,nextTime:.2,crossfade:0},stops,walkCycle:1.133333,native:.7,phase0:null,v0:null});
    assert(!(tight.start&&tight.stop),'3 m / 4.29 s cannot fit start+stop');assert(tight.notes.some(n=>/cruise .* outside/.test(n)),tight.notes.join(';'));
    return {extraSeconds:+extra.toFixed(4),sweep:out,shortWalkNotes:short.notes,tightNotes:tight.notes};});
  // ---------- 180 L/R selection ----------
  check('loco: chooseTurn 180 L/R: side by sign below 170 deg; >=170 the free foot steps first (last landed L -> bodyR); single walk_turn_180 kept with the controller yaw',()=>{
    const mk=names=>({has:n=>names.indexOf(n)>=0,duration:()=>1.5});const cfg=motion.parseAnimMeta({clips:{walk_turn_180_bodyL:{turn_deg:180,events:[{name:'foot:R',bone:'foot.R',body:'L',time_s:.5}]},walk_turn_180_bodyR:{turn_deg:-180,events:[{name:'foot:L',bone:'foot.L',body:'R',time_s:.5}]},walk_turn_180:{turn_deg:180,events:[{name:'foot:R',bone:'foot.R',body:'L',time_s:.5}]}}});
    const both=mk(['walk_turn_180_bodyL','walk_turn_180_bodyR']),r=x=>x*Math.PI/180;const res={};
    let c=motion.chooseTurn(both,cfg,r(150),'L');assert.equal(c.role,'walk_turn_180_bodyL');assert.equal(c.deltaRad,r(150));res.p150=c.reason;
    c=motion.chooseTurn(both,cfg,r(-150),null);assert.equal(c.role,'walk_turn_180_bodyR');
    c=motion.chooseTurn(both,cfg,r(175),'L');assert.equal(c.role,'walk_turn_180_bodyR');assert(Math.abs(deg(c.deltaRad)+185)<1e-9,'goes the other way: '+deg(c.deltaRad));res.p175L=c.reason;
    c=motion.chooseTurn(both,cfg,r(175),'R');assert.equal(c.role,'walk_turn_180_bodyL');assert.equal(c.deltaRad,r(175));
    c=motion.chooseTurn(both,cfg,r(-178),'R');assert.equal(c.role,'walk_turn_180_bodyL');assert(Math.abs(deg(c.deltaRad)-182)<1e-9);
    const one=mk(['walk_turn_180']);c=motion.chooseTurn(one,cfg,r(-161),'R');assert.equal(c.role,'walk_turn_180');assert.equal(c.deltaRad,r(-161));res.single161=c.reason;
    c=motion.chooseTurn(one,cfg,r(-175),'R');assert.equal(c.role,'walk_turn_180');assert(Math.abs(deg(c.deltaRad)-185)<1e-9);
    c=motion.chooseTurn(one,cfg,r(90),'R');assert.equal(c.role,null);return res;});
  if(!have){check('loco: real locomotion-v1 clips (SKIPPED: no '+glb+')',()=>({skipped:true}));return;}
  // ---------- no double footstep: same-contact rule when a meta lacks the entry_contact flag ----------
  {const m=clone(META);for(const k of ['walk_stop_bodyL','walk_stop_bodyR']){const ev=m.clips[k].events[0];delete ev.entry_contact;ev.time_s=0.01;}
   const r=await straightRun(m,{glb,L:4.198,dur:4.198/0.7+0.834,stopAtEnd:true});const st=r.plan.stop;const ded=r.events.filter(e=>e.kind==='foot-dedupe');
   check('loco: one contact = one footstep without the flag (stop clip contact at 0.01 s, same bone as the entry heel strike) -> dropped as same contact',()=>{assert(st,'stop planned '+JSON.stringify(r.plan));
     assert.equal(ded.length,1,JSON.stringify(ded));assert.equal(ded[0].reason,'same contact');for(let k=1;k<r.fe.length;k++)assert(r.fe[k].bone!==r.fe[k-1].bone,'same foot twice '+JSON.stringify([r.fe[k-1],r.fe[k]]));
     return {stop:st,deduped:ded.map(e=>e.reason+':'+e.clip+':'+e.event)};});}
  // ---------- real clips: foot slide, curves vs old constant root ----------
  const slides={};for(const [k,meta,stop] of [['new',META,true],['oldConstantRoot',stripRoot(META),true]]){const r=await straightRun(meta,{glb,L:4.198,dur:4.198/0.7,stopAtEnd:stop});r.label=k;slides[k]=r;}
  check('loco: foot slide rest -> walk_start -> walk_loop -> stop -> idle on the real clips (4.198 m / 5.997 s = toDoor), root_motion curves vs the old constant 0.7 m/s root',()=>{const n=slides.new,o=slides.oldConstantRoot;
    const sn=slideOf(n.samples),so=slideOf(o.samples);const worstN=Math.max(sn['foot.L'].worstMm,sn['foot.R'].worstMm),worstO=Math.max(so['foot.L'].worstMm,so['foot.R'].worstMm);
    assert(n.plan.start&&n.plan.stop,'planned '+JSON.stringify(n.plan));assert(worstN<12,'slide '+JSON.stringify(sn));assert(worstO>worstN*2,'old should slide clearly more '+worstO);
    const seq=[...new Set(n.clips)];assert.deepEqual(seq.slice(0,3),['walk_start','walk_loop',n.plan.stop]);assert(seq.indexOf('idle_breathing_loop')>seq.indexOf(n.plan.stop));
    const endErr=Math.hypot(n.end.x,n.end.z-4.198)*1000;assert(endErr<7,'end '+endErr);
    let mono=true;for(let i=1;i<n.samples.length;i++)if(n.samples[i].wp!==null&&n.samples[i-1].wp!==null&&n.samples[i].wp<n.samples[i-1].wp-1e-12)mono=false;assert(mono);
    return {plan:n.plan,newSlide:sn,oldSlide:so,clipSequence:seq,endOffsetMm:+endErr.toFixed(2),stanceThresholdMm:STANCE_MM};});
  // settle:* (角色动画bot: the last stop step is < 0.25 m, feet end side by side) is not a footstep: never on onFoot, but it is
  // the last foot to land (lastFoot) and is logged once as a 'settle' event
  check('loco: no double footstep at the stop entry (walk_loop heel strike once; stop clip t=0 entry_contact never emitted); settle:* step not a footstep, logged + lastFoot',()=>{const fe=slides.new.fe;const st=slides.new.plan.stop;
    const i=fe.findIndex(e=>e.clip===st);assert(i>0,'stop feet');const entry=fe[i-1];assert.equal(entry.clip,'walk_loop');const want=st==='walk_stop_bodyL'?'L':'R';assert.equal(entry.body,want,'entry heel strike body = variant');
    for(let k=1;k<fe.length;k++)assert(fe[k].bone!==fe[k-1].bone,'same foot twice '+JSON.stringify([fe[k-1],fe[k]]));const types=fe.filter(e=>e.clip===st).map(e=>e.type);assert.deepEqual(types,['heel_strike']);
    assert(!fe.some(e=>/^settle:/.test(e.event)),'settle on onFoot');const sdef=META.clips[st].events.find(e=>e.type==='settle');
    const settles=slides.new.events.filter(e=>e.kind==='settle');assert.equal(settles.length,1,JSON.stringify(settles));assert.equal(settles[0].clip,st);assert.equal(settles[0].event,sdef.name);assert.equal(settles[0].body,sdef.body);
    assert.equal(slides.new.motion.lastFoot,sdef.body,'lastFoot after the settle step');
    const gap=fe[i].t-entry.t;assert(gap>.5,'next contact '+gap);return {entry:{t:+entry.t.toFixed(3),body:entry.body,phase:+entry.phase.toFixed(4)},stopFeet:fe.filter(e=>e.clip===st).map(e=>e.event+':'+e.type+'@'+e.time),settle:settles[0].event+' body '+settles[0].body,footDeduped:slides.new.motion.footDeduped};});
  // ---------- stop variant selection over a sweep of lengths ----------
  // baseline: this walk_loop's own stance drift at rate 1 (long walk, no stop -> no warp). The clip's heel lands slower than
  // the ground (stance foot speed mean 0.667 vs 0.70 m/s over the low window), so even rate 1 drifts ~15-17 mm.
  const base=await straightRun(META,{glb,L:8,dur:8/0.7,stopAtEnd:false});const B=slideOf(base.samples.filter(x=>x.t<8/0.7-1.5)).byClip.walk_loop;assert(Math.abs(base.plan.warp-1)<1e-9);
  const C=motion.parseAnimMeta(META).clips.walk_loop;const cyc=1.133333,flat=0.37*cyc;   // anim_meta phases: heel strike .. heel off = 0.37 cycle
  const allowMm=w=>B+Math.abs(1-1/w)*0.7*flat*1000+2;
  const sweep=[];for(const L of [3.0,3.1,3.2,3.3,3.4,3.5,3.6,3.7]){const r=await straightRun(META,{glb,L,dur:L/0.7+motion.walkProfileExtraSeconds(motion.parseAnimMeta(META),true,true),stopAtEnd:true,tail:1.8});const p=r.plan;const fe=r.fe;const i=fe.findIndex(e=>/walk_stop/.test(e.clip));
    const entryEv=i>0?fe[i-1]:null;const s=slideOf(r.samples);const walkSlide=Math.max(0,...Object.keys(s.byClip).filter(k=>/^walk_/.test(k)).map(k=>s.byClip[k]));
    sweep.push({L,stop:p.stop,warp:p.warp,stopScale:p.stopScale,entryBody:entryEv&&entryEv.body,entryPhase:entryEv?+entryEv.phase.toFixed(4):null,slideMm:walkSlide,allowMm:+allowMm(p.warp).toFixed(2),byClip:s.byClip,endMm:+(Math.hypot(r.end.x,r.end.z-L)*1000).toFixed(2),notes:p.notes});}
  check('loco: stop variant = the walk_loop heel strike at the entry distance (bodyL at walk 0.0 s, bodyR at 0.567 s), both used over lengths 3.0..3.7 m, stride warp <= STOP_WARP_MAX, stop scale <= STOP_SCALE_MAX, slide <= rate-1 baseline + warp drift',()=>{
    for(const w of sweep){if(!w.stop){assert(w.notes.some(n=>/warp/.test(n)),'no stop without a warp note '+JSON.stringify(w));continue;}assert.equal(w.entryBody,w.stop==='walk_stop_bodyL'?'L':'R',JSON.stringify(w));
      assert(Math.abs(w.warp-1)<=motion.STOP_WARP_MAX+1e-9);assert(Math.abs(w.stopScale-1)<=motion.STOP_SCALE_MAX+1e-9);assert(w.slideMm<=w.allowMm,JSON.stringify(w));assert(w.endMm<7,JSON.stringify(w));}
    const used=new Set(sweep.filter(w=>w.stop).map(w=>w.stop));assert(used.size===2,'both variants '+JSON.stringify(sweep));return {baselineWalkLoopMm:B,sweep};});
  // ---------- full out-and-back with the route rest predicate ----------
  // every motion event of the run (diagnostics().events is only the last 32): logEvent objects collected by identity
  const stops=[],turns=[],plans=[],allEv=[],seen=new Set();let prevClip='',prevPlan=null;const fr=await flowRun('real',{predicate:true,character:{glb,meta:META},frame:(c,state,t)=>{const d=c.s.diagnostics();
    for(const e of d.events)if(!seen.has(e)){seen.add(e);allEv.push(Object.assign({t:+t.toFixed(3),state},e));}
    if(d.motion.walkPlan!==prevPlan){prevPlan=d.motion.walkPlan;if(prevPlan)plans.push({t:+t.toFixed(3),state,...prevPlan});}if(d.clip!==prevClip&&/walk_stop|walk_turn/.test(d.clip))(/stop/.test(d.clip)?stops:turns).push({t:+t.toFixed(3),state,clip:d.clip,root:[+c.node.worldPosition.x.toFixed(4),+c.node.worldPosition.z.toFixed(4)],plan:d.motion.walkPlan});prevClip=d.clip;}});
  const pathLen=p=>{let L=0;for(let i=1;i<p.length;i++)L+=Math.hypot(p[i][0]-p[i-1][0],p[i][1]-p[i-1][1],p[i][2]-p[i-1][2]);return L;};
  check('loco: out-and-back flow (real WorldFlow + routes; rest chains from the routes: toDoor | outCrossing->toIsland | toThreshold->inCrossing->toSeat on the follow return, no stop at the entrance): a planned stop inside exactly the walks that end at rest, none at the continuous joins, no unplanned stop, slide bounded',()=>{
    const cfg=fr.cfg,chains=motion.restChainsFor(cfg);assert.equal(chains,motion.REST_CHAINS_FOLLOW,'follow return routes (cameraEntry.doorSeconds '+(cfg.cameraEntry&&cfg.cameraEntry.doorSeconds)+')');
    const ends={};for(const ch of chains)ends[ch[ch.length-1]]=cfg[ch[ch.length-1]];
    // continuous walks: planned as joins (aheadM = rest of the chain), never as a rest
    const ic=plans.find(p=>p.state==='crossing-in'),tt=plans.find(p=>p.state==='walking-home');
    assert(ic&&ic.rest===false&&!ic.stop&&Math.abs(ic.aheadM-pathLen(cfg.toSeat))<1e-6,'inCrossing joins toSeat '+JSON.stringify(ic));
    assert(tt&&tt.rest===false&&!tt.stop&&Math.abs(tt.aheadM-pathLen(cfg.inCrossing)-pathLen(cfg.toSeat))<1e-6,'toThreshold steers toward the toSeat rest '+JSON.stringify(tt));
    const near=(p,q)=>Math.hypot(p[0]-q[0],p[1]-q[2])<.3;assert.equal(stops.length,3,JSON.stringify({stops,plans}));
    const where=stops.map(s=>Object.keys(ends).find(k=>near(s.root,ends[k][ends[k].length-1]))||'?');assert.deepEqual(where,['toDoor','toIsland','toSeat'],JSON.stringify(stops));
    for(const s of stops)assert(s.plan&&s.plan.rest&&s.plan.stop===s.clip,'stop planned in its walk '+JSON.stringify(s));
    const unplanned=allEv.filter(e=>e.kind==='stop-unplanned');assert.equal(unplanned.length,0,JSON.stringify(unplanned));assert(fr.tr.worst.mm<15,JSON.stringify(fr.tr.worst));
    return {chains,stops:stops.map((s,i)=>({walk:where[i],t:s.t,clip:s.clip,warp:s.plan&&s.plan.warp,cruiseMps:s.plan&&s.plan.cruiseMps,start:s.plan&&s.plan.start,startRate:s.plan&&s.plan.startRate})),joins:{inCrossingAheadM:+ic.aheadM.toFixed(3),toThresholdAheadM:+tt.aheadM.toFixed(3)},
      turns:allEv.filter(e=>e.kind==='turn-choice').map(e=>({t:e.t,state:e.state,clip:e.clip,deg:+e.deg.toFixed(1),lastFoot:e.lastFoot,reason:e.reason})),walkLoopStanceMaxMm:+fr.tr.worst.mm.toFixed(2),cornerMaxMm:+fr.tr.corner.mm.toFixed(1)};});
  // r5 #5: at the island she stopped walk_loop -> idle and turned ~25 deg in place on the breathing loop
  check('loco: island arrival: the < 45 deg turn after the toIsland stop is folded into the stop clip (yaw only changes while the stop clip plays, done by its end, then idle; never on idle, no turn clip)',()=>{
    const isl=stops[1],seg=[];let k=fr.rec.findIndex(r=>r.t>=isl.t);while(k<fr.rec.length&&fr.rec[k].action!=='turn')k++;assert(k<fr.rec.length,'turn after the toIsland stop');
    for(;k<fr.rec.length&&fr.rec[k].action==='turn';k++)seg.push({t:fr.rec[k].t,clip:fr.rec[k].clip,prev:fr.rec[k-1].clip,yaw:fr.rec[k].yaw,dy:Math.abs(H.wrap(fr.rec[k].yaw-fr.rec[k-1].yaw))});
    const ch=allEv.find(e=>e.kind==='turn-choice'&&e.t>=isl.t);const total=H.deg(Math.abs(H.wrap(seg[seg.length-1].yaw-fr.rec[fr.rec.findIndex(r=>r.t===seg[0].t)-1].yaw)));
    assert(ch&&ch.clip===null&&/^folded into walk_stop_body/.test(ch.reason),JSON.stringify(ch));assert(total>1&&total<45,'turn '+total);
    const moving=seg.filter(s=>s.dy>1e-7);assert(moving.length>10,'yaw frames '+moving.length);for(const s of moving)assert(s.clip===isl.clip||s.prev===isl.clip,'yaw change on '+s.clip+' at '+s.t.toFixed(3)); // (last yaw frame = the frame the stop clip ends)
    const clips=[...new Set(seg.map(s=>s.clip))];assert.deepEqual(clips,[isl.clip,'idle_breathing_loop'],JSON.stringify(clips));
    return {stop:isl.clip,turnDeg:+total.toFixed(2),reason:ch.reason,yawFrames:moving.length,turnFrames:seg.length,clips};});
  // 180 L/R and 90 L/R on the real clips: the side follows the turn (90s and the 180 below TURN180_FREE_DEG), the foot decides >= 170
  {const info={has:n=>!!META.clips[n],duration:()=>1.5},cfg=motion.parseAnimMeta(META),r=x=>x*Math.PI/180;
   check('loco: turn variants on the real clips: +-90 -> walk_turn_90_body{L,R}; return turn -161.5 -> walk_turn_180_bodyR, +161.5 -> walk_turn_180; >= 170 deg by the last foot (incl. settle); in the flow the return turn uses walk_turn_180_bodyR',()=>{
    const c=(d,f)=>motion.chooseTurn(info,cfg,r(d),f);const res={};
    assert.equal(c(95,'R').role,'walk_turn_90_bodyL');assert.equal(c(-95,'R').role,'walk_turn_90_bodyR');assert.equal(c(-95,'L').role,'walk_turn_90_bodyR');
    assert.equal(c(-161.5,'R').role,'walk_turn_180_bodyR');assert.equal(c(161.5,'L').role,'walk_turn_180');
    let x=c(175,'L');assert.equal(x.role,'walk_turn_180_bodyR');assert(Math.abs(H.deg(x.deltaRad)+185)<1e-9);res.p175L=x.reason;x=c(-175,'R');assert.equal(x.role,'walk_turn_180');assert(Math.abs(H.deg(x.deltaRad)-185)<1e-9);res.m175R=x.reason;
    const ret=turns.find(t=>t.state==='walking-home');assert(ret&&ret.clip==='walk_turn_180_bodyR',JSON.stringify(turns));
    res.flow=turns.map(t=>t.state+':'+t.clip);return res;});}
  // r5 #5: settleFromWalk only ran when nothing followed; an unplanned walk end now plays the stop clip's tail (root still)
  {const run=async(turnDeg)=>{const c=makeCharacter({glb,meta:META});c.s.cancelAndReset({kind:'standing',controllerRoot:[0,0,0],yawRad:0});for(let i=0;i<20;i++)c.s.advance(1/60);
     const L=3.3,seq=[],ev=[],seen2=new Set();const rec=()=>{const d=c.s.diagnostics();for(const e of d.events)if(!seen2.has(e)){seen2.add(e);ev.push(e);}seq.push({clip:d.clip,yaw:c.node.yaw,x:c.node.worldPosition.x,z:c.node.worldPosition.z,action:d.action});};
     const w=c.s.perform({kind:'walk',path:[[0,0,0],[0,0,L]],duration:L/0.7,stopAtEnd:false},new Token());let done=false;w.then(()=>{done=true;});while(!done){c.s.advance(1/60);await flush();rec();}
     const endAt=seq.length;if(turnDeg!==null){const tp=c.s.perform({kind:'turn',controllerRoot:[0,0,L],fromYawRad:0,toYawRad:turnDeg*Math.PI/180,direction:'left'},new Token());let td=false;tp.then(()=>{td=true;});while(!td){c.s.advance(1/60);await flush();rec();}}
     for(let i=0;i<120;i++){c.s.advance(1/60);await flush();rec();}return {seq,ev,endAt,L};};
   const idle=await run(null),turn=await run(20);
   check('loco: unplanned walk end (stopAtEnd:false): stop clip tail from its settle time (root does not move: no slide / overshoot), then idle; a small turn right after it is folded into that tail (stop before the next task)',()=>{const out={};
    for(const [name,r] of [['noTask',idle],['turn20',turn]]){const after=r.seq.slice(r.endAt-1);const clips=[...new Set(after.map(s=>s.clip))];const u=r.ev.filter(e=>e.kind==='stop-unplanned');
     assert.equal(u.length,1,JSON.stringify(u));assert(/^walk_stop_body[LR]$/.test(u[0].clip)&&u[0].from>0.6,JSON.stringify(u));assert.deepEqual(clips.filter(x=>x!=='walk_loop'),[u[0].clip,'idle_breathing_loop'],JSON.stringify(clips));
     let drift=0;for(const s of after)drift=Math.max(drift,Math.hypot(s.x,s.z-r.L));assert(drift<1e-6,'root moved after the walk end '+drift);
     const settle=r.ev.filter(e=>e.kind==='settle');assert.equal(settle.length,1,'settle step of the tail '+JSON.stringify(settle));
     if(name==='turn20'){const ch=r.ev.find(e=>e.kind==='turn-choice');assert(ch&&/^folded into/.test(ch.reason),JSON.stringify(ch));
      for(let i=r.endAt;i<r.seq.length;i++)if(Math.abs(H.wrap(r.seq[i].yaw-r.seq[i-1].yaw))>1e-7)assert(r.seq[i].clip===u[0].clip||r.seq[i-1].clip===u[0].clip,'yaw change on '+r.seq[i].clip);
      assert(Math.abs(H.deg(r.seq[r.seq.length-1].yaw)-20)<1e-6);out.turnReason=ch.reason;}
     out[name]={tail:u[0].clip,fromS:+u[0].from.toFixed(4),clips,rootDriftM:drift};}
    return out;});}
  // walk_start rate: outCrossing (1.987 m / 2.839 s from rest at the door) cannot fit walk_start at rate 1 (cruise 1.43 x native)
  // compared with the same clip at rate 1 (toDoor), both sampled at 240 Hz (at 60 Hz the stance-window maximum depends on where
  // the samples fall: 10.1 vs 12.7 mm for the same clip); the clip's own stance drift is ~14 mm
  {const oc=plans.find(p=>p.state==='crossing-out'),L=oc?oc.L:1.9872,D=oc?oc.D:2.8389;const ws=r=>slideOf(r.samples.filter(x=>x.label==='walk_start'));
   const fast=await straightRun(META,{glb,L,dur:D,stopAtEnd:false,tail:.5,hz:240}),ref=await straightRun(META,{glb,L:4.198,dur:4.198/0.7,stopAtEnd:true,tail:.5,hz:240});
   check('loco: walk_start sped up (<= START_RATE_MAX, cadence inside CRUISE_RATIO_MAX) when a walk from rest has no room at rate 1: outCrossing starts with walk_start; its stance drift <= the same clip at rate 1 (+1 mm) and < 15 mm',()=>{
    assert(oc&&oc.start===true&&oc.startRate>1&&oc.startRate<=motion.START_RATE_MAX+1e-9,JSON.stringify(oc));assert(oc.notes.some(n=>/^walk_start x/.test(n)),JSON.stringify(oc.notes));
    assert(fast.plan.start&&fast.plan.startRate===oc.startRate,JSON.stringify(fast.plan));assert(ref.plan.start&&ref.plan.startRate===1,JSON.stringify(ref.plan));
    assert.equal(fast.clips.find(x=>x!=='idle_breathing_loop'),'walk_start');assert(fast.plan.cruiseMps/0.7<=motion.CRUISE_RATIO_MAX+1e-9);
    const sf=ws(fast),sr=ws(ref),wf=Math.max(sf['foot.L'].worstMm,sf['foot.R'].worstMm),wr=Math.max(sr['foot.L'].worstMm,sr['foot.R'].worstMm);
    assert(wf<=wr+1&&wf<15,'walk_start slide x'+oc.startRate+' '+JSON.stringify(sf)+' vs rate 1 '+JSON.stringify(sr));
    const endErr=Math.hypot(fast.end.x,fast.end.z-L)*1000;assert(endErr<1e-3,'end '+endErr);return {plan:oc,walkStartSlideMm:{['x'+oc.startRate]:wf,x1:wr},sampleHz:240};});}}
module.exports={install,run};
