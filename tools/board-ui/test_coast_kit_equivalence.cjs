'use strict';
/* coast-kit-equivalence (P1, Grok Bot 10/30): the coast config only changes rendering and hit geometry, never the rules.
 * - Off by default: boardKitFor('coast') = DEFAULT_KIT until setCoastBoardKit(true); switching it on changes no other region's kit.
 * - Every verified replay (tide / meadow / sky, all seeds) and the 24 mainline levels (bank 0) on all 7 screens are played twice:
 *   OFF: taps inside the 2D grid cell (DEFAULT_KIT kitGrid + kitCellAt), ON: taps within ±8 pt of the cell's projected coast centre
 *   (COAST_KIT kitGrid + kitCellAt). After every step the full rules state must be identical (0 differences) and fallback = 0.
 * Self-check: one injected tap on the neighbouring projected tile must be reported. */
const assert=require('node:assert/strict'),path=require('node:path');const {createHarness}=require('./harness.cjs');const H=createHarness();
const K=H.load('ui/BoardKit'),B=H.load('ui/BoardProjection'),L=H.load('ui/BoardLayout'),E=require('./coast-board-eval.cjs');
const S=path.resolve(__dirname,'../../creator-build-project/assets/scripts');
const Main=require(S+'/mainline-r1/runtime/mainline-controller'),API=require(S+'/regional-r05/runtime/index');
const W=require('../region-levels/verified-mainline.json').entries,RW=require('../persistence-fixtures/verified-replays.json');
assert.equal(K.boardKitFor('coast'),K.DEFAULT_KIT,'coast config must be OFF by default');
let seed=7;const rand=()=>((seed=(seed*1103515245+12345)&0x7fffffff)/0x7fffffff);
const strip=o=>JSON.parse(JSON.stringify(o,(k,v)=>/attemptId|token|storageKey|generation/.test(k)?undefined:v));
function memory(){const m=new Map();return {load:k=>m.has(k)?JSON.parse(m.get(k)):null,save(k,v){m.set(k,JSON.stringify(v));return true;}};}
function flush(c){let n=0;while(c.snapshot().visual){const t=c.snapshot().visual.token;assert(c.finishVisualStep(t).ok);assert(++n<300);}}
function actMain(c,a){const q=c.previewAction(a);if(!q.ok)return q;const r=c.commitAction(q.token);if(r.ok)flush(c);return r;}
function run(inject){
 const out={runs:0,steps:0,diffs:[]};
 for(const [w,h] of inject?[[320,568]]:E.SCREENS){const l=L.boardLayout(w,h,L.boardSafeInsets(w,h));
  const off=K.kitGrid(K.boardKitFor('coast'),l);B.setCoastBoardKit(true);const on=K.kitGrid(K.boardKitFor('coast'),l);B.setCoastBoardKit(false);
  assert.equal(off.projected,false);assert.equal(on.projected,true);
  const tapOff=i=>{const c=L.cellCenter(l,i),P=l.pitch;return K.kitCellAt(off,c.x+(rand()-.5)*.9*P,c.y+(rand()-.5)*.9*P);};
  const tapOn=(i,bad)=>{const c=on.centers[i];const r=K.kitCellAt(on,c.x+(rand()*2-1)*8,c.y+(rand()*2-1)*8);return bad?(r%7<6?r+1:r-1):r;};
  const map=(a,t,bad)=>a[0]==='swap'?['swap',t(a[1],bad),t(a[2])]:['activate',t(a[1],bad)];
  const diff=(where,a,b)=>{if(out.diffs.length<20)out.diffs.push(where+': '+JSON.stringify(a).slice(0,140)+' ≠ '+JSON.stringify(b).slice(0,140));else out.diffs.push('');};
  for(const id of Object.keys(RW))for(const rp of RW[id]){const so=API.createSession(id,rp.seed),sk=API.createSession(id,rp.seed);out.runs++;
   rp.actions.forEach((a,si)=>{const ro=so.act(map(a,tapOff)),rk=sk.act(map(a,tapOn,inject&&si===1));out.steps++;
    const A1=strip({r:ro,c:so.checkpoint()}),B1=strip({r:rk,c:sk.checkpoint()});if(JSON.stringify(A1)!==JSON.stringify(B1))diff(`${w}x${h} ${id}:${rp.seed} step ${si}`,A1.r,B1.r);});
   if(inject)return out;}
  const co=new Main({platform:memory(),attemptIdFactory:()=>'a'}),ck=new Main({platform:memory(),attemptIdFactory:()=>'a'});
  for(let lv=0;lv<12;lv++){const wt=W.filter(x=>x.level===lv)[0];if(!wt)continue;const so=co.startStage(wt.stageId,{seed:wt.seed}),sk=ck.startStage(wt.stageId,{seed:wt.seed});
   if(!so.ok||!sk.ok)throw Error('mainline start '+wt.stageId);out.runs++;
   wt.actions.forEach((a,si)=>{const ro=actMain(co,map(a,tapOff)),rk=actMain(ck,map(a,tapOn));out.steps++;
    const A1=strip({r:ro,s:co.snapshot()}),B1=strip({r:rk,s:ck.snapshot()});if(JSON.stringify(A1)!==JSON.stringify(B1))diff(`${w}x${h} ${wt.stageId} step ${si}`,A1.r,B1.r);});}}
 return out;}
// switch: on registers coast only
B.setCoastBoardKit(true);assert.equal(K.boardKitFor('coast'),K.COAST_KIT);for(const r of [null,'','tide','meadow','sky','island'])assert.equal(K.boardKitFor(r),K.DEFAULT_KIT,'coast switch leaked into '+r);
B.setCoastBoardKit(false);assert.equal(K.boardKitFor('coast'),K.DEFAULT_KIT);
globalThis.__qfCoastBoardKit=true;assert.equal(B.coastBoardKitFromFlag(),true);assert.equal(K.boardKitFor('coast'),K.COAST_KIT);delete globalThis.__qfCoastBoardKit;assert.equal(B.coastBoardKitFromFlag(),false);assert.equal(K.boardKitFor('coast'),K.DEFAULT_KIT);
const self=run(true);assert.ok(self.diffs.length>0,'self-check: injected neighbouring tap not detected');console.log(`ok   self-check: 1 injected neighbouring tap (320x568) → ${self.diffs.length} differences`);
const r=run(false);
console.log(`coast-kit-equivalence: ${r.runs} runs on 7 screens (verified replays + 12 mainline levels), ${r.steps} steps, ${r.diffs.length} differences, fallback=${K.kitFallbackCount()}`);
for(const d of r.diffs.filter(Boolean))console.log('     DIFF '+d);
if(r.diffs.length||K.kitFallbackCount()){console.log('coast-kit-equivalence: FAIL');process.exit(1);}
console.log('coast-kit-equivalence: PASS (rules state identical with the coast config on and off; off by default)');
