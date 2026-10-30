'use strict';
/* board-kit-equivalence (coast pilot P0, Grok Bot decision 7, 10/30): the kit path must not change a single rules outcome.
 * For every verified level replay (12 mainline levels × 3 seed banks via the real MainlineController, 12 regional challenges × 3
 * seeds via the real regional session) every recorded action is turned into screen taps on all 7 screens and resolved twice:
 *   old renderer: the REAL ManagedMobileBoardUI.prototype.cellAt on the real boardLayout / cellCenter geometry;
 *   kit renderer: BoardKit.kitGrid(boardKitFor(region)) + kitCellAt.
 * Each resolved action drives its own session; after every step the full rules state (checkpoint / snapshot without
 * attempt ids) and the piece / goal art of every tile must be identical. 0 differences, else FAIL.
 * Self-check: one injected difference (one tap moved to the neighbouring cell on one step) must be reported as a FAIL. */
const assert=require('node:assert/strict'),path=require('node:path'),fs=require('node:fs');
const {createHarness}=require('./harness.cjs');const H=createHarness();
const ROOT=path.resolve(__dirname,'../..'),S=ROOT+'/creator-build-project/assets/scripts';
const UI=H.load('ManagedMobileBoardUI'),K=H.load('ui/BoardKit'),L=H.load('ui/BoardLayout'),A=H.load('ui/BoardArt');
const Main=require(S+'/mainline-r1/runtime/mainline-controller'),API=require(S+'/regional-r05/runtime/index');
const W=require('../region-levels/verified-mainline.json').entries,RW=require('../persistence-fixtures/verified-replays.json');
const src=fs.readFileSync(S+'/ManagedMobileBoardUI.ts','utf8'),gm=/const GOAL_ART: Record<string, string> = (\{[^}]*\});/.exec(src);assert.ok(gm,'GOAL_ART table');
const GOAL_ART=Function('return '+gm[1])();
const SCREENS=[[390,844],[414,896],[360,780],[375,667],[320,568],[390,520],[768,1024]];
const SAFE={390:{top:47,bottom:34},414:{top:48,bottom:34},360:{top:24,bottom:0},375:{top:20,bottom:0},320:{top:20,bottom:0},768:{top:24,bottom:20}};
function geom(w,h){const s=SAFE[w]||{top:20,bottom:0},safe={top:s.top,bottom:s.bottom,left:0,right:0,capsule:null},l=L.boardLayout(w,h,safe);
 const old={layoutInfo:{width:w,height:h},grid:{worldPosition:{x:l.grid.x-w/2,y:h/2-l.grid.y}},cell:l.pitch};
 return {l,old,kit:K.kitGrid(K.boardKitFor(null),l)};}
const cellAtOld=UI.ManagedMobileBoardUI.prototype.cellAt;assert.equal(typeof cellAtOld,'function','ManagedMobileBoardUI.cellAt');
let rnd=12345;const rand=()=>((rnd=(rnd*1103515245+12345)&0x7fffffff)/0x7fffffff);
function tap(g,i,inject){// a finger inside cell i (±0.45 pitch) → both renderers' cell
 const c=L.cellCenter(g.l,i),P=g.l.pitch,x=c.x+(rand()-0.5)*0.9*P,y=c.y+(rand()-0.5)*0.9*P;
 const o=cellAtOld.call(g.old,x,g.l.height-y,false);let k=K.kitCellAt(g.kit,x,y);if(inject)k=k%7<6?k+1:k-1;return [o,k];}
function mapAction(g,a,inject){if(a[0]==='swap'){const [o1,k1]=tap(g,a[1],inject),[o2,k2]=tap(g,a[2],false);return [['swap',o1,o2],['swap',k1,k2]];}
 if(a[0]==='activate'){const [o,k]=tap(g,a[1],inject);return [['activate',o],['activate',k]];}throw Error('unmapped action '+JSON.stringify(a));}
const strip=o=>JSON.parse(JSON.stringify(o,(k,v)=>/attemptId|token|storageKey|generation/.test(k)?undefined:v));
function artOf(board,keysOld,keysKit){const o=[],k=[];for(const t of board||[]){if(!t||typeof t.type!=='number')continue;o.push(keysOld[t.type]);k.push(K.kitPieceKey(K.boardKitFor(null),t.type));}return [o,k];}
function memory(){const m=new Map();return {load:k=>m.has(k)?JSON.parse(m.get(k)):null,save(k,v){m.set(k,JSON.stringify(v));return true;}};}
function flush(c){let n=0;while(c.snapshot().visual){const t=c.snapshot().visual.token;assert(c.finishVisualStep(t).ok);assert(++n<300);}}
function actMain(c,a){const q=c.previewAction(a);if(!q.ok)return q;const r=c.commitAction(q.token);if(r.ok)flush(c);return r;}
function run(inject){const out={levels:0,steps:0,taps:0,diffs:[]};const diff=(where,a,b)=>{if(out.diffs.length<20)out.diffs.push(where+': '+JSON.stringify(a).slice(0,160)+' ≠ '+JSON.stringify(b).slice(0,160));else out.diffs.push('');};
 for(const [w,h] of inject?[[390,844]]:SCREENS){const g=geom(w,h);
  // mainline: banks in order on one save each (old/kit), level n needs n-1
  for(const bank of inject?[0]:[0,1,2]){const co=new Main({platform:memory(),attemptIdFactory:()=>'a'}),ck=new Main({platform:memory(),attemptIdFactory:()=>'a'});
   for(let lv=0;lv<12;lv++){const wt=W.filter(x=>x.level===lv)[bank];if(!wt)continue;
    const so=co.startStage(wt.stageId,{seed:wt.seed}),sk=ck.startStage(wt.stageId,{seed:wt.seed});
    if(!so.ok||!sk.ok){if(JSON.stringify(strip(so))!==JSON.stringify(strip(sk)))diff(`${w}x${h} ${wt.stageId}#${bank} start`,so,sk);if(bank===0&&!inject)throw Error('mainline start '+wt.stageId+' '+JSON.stringify(so));continue;}
    out.levels++;wt.actions.forEach((a,si)=>{const [ao,ak]=mapAction(g,a,inject&&w===390&&lv===3&&si===2&&bank===0);out.taps+=a.length-1;
     const ro=actMain(co,ao),rk=actMain(ck,ak);out.steps++;
     const A1=strip({r:ro,s:co.snapshot()}),B1=strip({r:rk,s:ck.snapshot()});if(JSON.stringify(A1)!==JSON.stringify(B1))diff(`${w}x${h} ${wt.stageId}#${bank} step ${si}`,A1.s.active||A1.r,B1.s.active||B1.r);
     const [ao2,ak2]=artOf(co.snapshot().active&&co.snapshot().active.board,A.PIECE_KEYS,null);if(JSON.stringify(ao2)!==JSON.stringify(ak2))diff(`${w}x${h} ${wt.stageId} art`,ao2,ak2);});}}
  // regional challenges (tide / meadow / sky): verified replays
  if(!inject)for(const id of Object.keys(RW))for(const rp of RW[id]){const so=API.createSession(id,rp.seed),sk=API.createSession(id,rp.seed);out.levels++;
   rp.actions.forEach((a,si)=>{const [ao,ak]=mapAction(g,a,false);out.taps+=a.length-1;const ro=so.act(ao),rk=sk.act(ak);out.steps++;
    const A1=strip({r:ro,c:so.checkpoint()}),B1=strip({r:rk,c:sk.checkpoint()});if(JSON.stringify(A1)!==JSON.stringify(B1))diff(`${w}x${h} ${id}:${rp.seed} step ${si}`,A1,B1);
    const [ao2,ak2]=artOf(so.engine&&so.engine.board,A.PIECE_KEYS,null);if(JSON.stringify(ao2)!==JSON.stringify(ak2))diff(`${w}x${h} ${id} art`,ao2,ak2);});
   if(!inject)assert.equal(so.checkpoint().expectedState,rp.expectedState,id+':'+rp.seed+' replay no longer reaches its verified state');}}
 return out;}
// static: default kit = shipped art / goal table / hit formula
assert.deepEqual([...K.boardKitFor(null).pieceKeys],[...A.PIECE_KEYS]);assert.deepEqual([...K.boardKitFor('tide').pieceKeys],[...A.PIECE_KEYS]);assert.equal(A.pieceKeysFor(K.DEFAULT_KIT),A.PIECE_KEYS);assert.equal(A.pieceKeysFor(null),A.PIECE_KEYS);
for(const key of [...Object.keys(GOAL_ART),'type0','type1','type2','type3','type4','type5','unknown-goal'])assert.equal(K.kitGoalArt(K.DEFAULT_KIT,key,GOAL_ART),UI.goalArt(key),'goalArt '+key);
assert.equal(K.kitFallbackCount(),0);
const self=run(true);assert.ok(self.diffs.length>0,'self-check: an injected one-cell difference was NOT detected — the gate is blind');
console.log(`ok   self-check: injected 1 moved tap (390x844 mainline-04 step 3) → ${self.diffs.length} differences reported`);
const r=run(false);
console.log(`board-kit-equivalence: ${r.levels} level runs (24 levels × 3 seeds × 7 screens), ${r.steps} steps, ${r.taps} taps compared, ${r.diffs.length} differences, fallback=${K.kitFallbackCount()}`);
for(const d of r.diffs.filter(Boolean))console.log('     DIFF '+d);
if(r.diffs.length||K.kitFallbackCount()){console.log('board-kit-equivalence: FAIL');process.exit(1);}
console.log('board-kit-equivalence: PASS');
