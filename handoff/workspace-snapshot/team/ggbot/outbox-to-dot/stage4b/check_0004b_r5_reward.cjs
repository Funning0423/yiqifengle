// 0004b self-test (Node, no Cocos): R5 first-clear reward merged into mainline inventory via the original write path.
// Usage: node check_0004b_r5_reward.cjs <path-to>/creator-build-project/assets/scripts
const path=require('path'),S=path.resolve(process.argv[2]||'.');
const Port=require(path.join(S,'mainline-r1/adapter/mainline-port.js'));
const Legacy=require(path.join(S,'world-r2/LegacyProgressionV3.js'));
let fail=0;const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);if(!c)fail++;};
function mem(init){const m=new Map(Object.entries(init||{}));return {m,getItem:k=>m.has(k)?m.get(k):null,setItem:(k,v)=>m.set(k,String(v))};}
const rec=(s)=>({bestStars:s,bestScore:s?100:null,bestMoves:s?3:null,clears:s?1:0});
// A realistic existing v3 save: tide stages 1-4 cleared, chest 0 opened, one windBell spent? (none granted -> 0)
const oldSave={version:3,regionClaims:[false,false,false],openedChests:[0,1],toolsSpent:{windBell:1,tideBottle:0,tideNet:0,sunSeed:0,starShears:0},
  inventory:{tools:{windBell:0,tideBottle:0,tideNet:0,sunSeed:0,starShears:0},charms:['seaRibbon']},equippedCharm:'seaRibbon',unlocked:4,completed:4,
  records:[rec(3),rec(2),rec(1),rec(1),...Array.from({length:8},()=>rec(0))],mementos:[0],attempts:[]};
const KEY='forest-v33-journey',raw0=JSON.stringify(oldSave);
// 1) old save upgrade: loads, not read-only, nothing rewritten just by reading
{const st=mem({[KEY]:raw0});const port=Port.createPort(st);const c=port.createController();const s=c.snapshot();
 ok(!s.readOnly&&!s.journey.readOnly,'old v3 save loads with 0004b code, not read-only (no signature/validation failure)');
 ok(st.getItem(KEY)===raw0,'reading an old save does not rewrite it (byte-identical)');
 ok(!('r5Claims' in s.journey),'old save view has no r5Claims field');
 const before=JSON.stringify(s.journey.inventory.tools);
 // 2) claim
 const r=c.claimR5FirstClear('r05-tide-02');
 ok(r.ok&&!(r.result&&r.result.duplicate),'claim r05-tide-02 ok');
 ok(JSON.stringify(r.newlyGrantedRewards)===JSON.stringify([{kind:'tool',id:'windBell',count:1}]),'reward = mainline chest level 1 (windBell x1)');
 const after=port.createController().snapshot().journey;
 ok(after.inventory.tools.windBell===s.journey.inventory.tools.windBell+1,'windBell inventory +1 in the real journey ('+before+' -> '+JSON.stringify(after.inventory.tools)+')');
 ok(JSON.stringify(after.r5Claims)==='["r05-tide-02"]','journey save records r5Claims');
 // 3) duplicate, and after cold start
 const d=port.createController().claimR5FirstClear('r05-tide-02');
 ok(d.ok&&d.result&&d.result.duplicate&&d.newlyGrantedRewards.length===0,'second claim is duplicate, grants nothing');
 const cold=Port.createPort(mem({[KEY]:st.getItem(KEY)})).createController();
 ok(cold.snapshot().journey.inventory.tools.windBell===after.inventory.tools.windBell,'cold start keeps inventory');
 const d2=cold.claimR5FirstClear('r05-tide-02');ok(d2.ok&&d2.result.duplicate&&!d2.newlyGrantedRewards.length,'cold start: claim still duplicate');
 // 4) other readers of the same save
 const L=new Legacy({load:k=>st.getItem(k)});ok(!L.readOnly,'LegacyProgressionV3 (pinned-hash reader used by R4/R5) still reads upgraded save, not read-only');
 // 5) charms + bad ids
 const ch=port.createController().claimR5FirstClear('r05-tide-01');ok(ch.ok&&ch.newlyGrantedRewards[0].id==='seaRibbon','r05-tide-01 -> seaRibbon (charm, already owned => no duplicate charm)');
 let threw=false;try{const x=port.createController().claimR5FirstClear('r05-moon-01');threw=!x.ok;}catch(e){threw=true;}ok(threw,'unknown stage id rejected');
 // 6) tampered r5Claims makes save read-only (same rule as other corrupt fields), original preserved
 const bad=JSON.parse(st.getItem(KEY));bad.r5Claims=['hack'];const bst=mem({[KEY]:JSON.stringify(bad)});const bs=Port.createPort(bst).createController().snapshot();
 ok(bs.journey.readOnly,'corrupt r5Claims => read-only, no minting');ok(bst.getItem(KEY)===JSON.stringify(bad),'corrupt save preserved untouched');
}
// 7) brand-new player
{const st=mem();const c=Port.createPort(st).createController();const r=c.claimR5FirstClear('r05-sky-04');ok(r.ok&&r.newlyGrantedRewards.length===2,'new profile: r05-sky-04 -> chest 11 rewards (starBrooch + windBell)');}
console.log(fail?`${fail} FAILED`:'ALL PASS');process.exit(fail?1:0);
