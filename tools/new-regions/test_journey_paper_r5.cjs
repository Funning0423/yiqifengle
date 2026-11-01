'use strict';
// r5 journey-book paper gate (界面验收部 P2 on fc3123fa, ui-audit/2026-10-30/new-regions-r4-fc3123fa/summary.md §1):
//  1. PAPER_INNER_SRC (JourneyPanels.ts) is re-derived from popup/panel_frame_9s.png: on every stretched middle row the paper
//     face (lum ≥ 0.8, after the bevel) starts/ends at the declared source px exactly. No per-width numbers anywhere.
//  2. On 320×568 / 375×667 / 390×844 / 414×896, day and night, bar + focus card + 3×3 grid sit ≥ 8 pt inside the paper inner
//     edge on both sides and match the audit's measured targets (x0–x1 screen pt) within 0.6 pt (audit reads in 0.5 pt steps).
//  3. Negative self-test: the r4 layout (centred, panel width − 2×(24+8) pt) fails the same check on every width, and its gaps
//     reproduce the audit's device measurements within 0.75 pt (device reads include ~0.5 pt of bevel AA; so the paper model matches the real screen).
const assert=require('node:assert/strict'),path=require('node:path'),fs=require('node:fs'),zlib=require('node:zlib'),{createHarness}=require('../board-ui/harness.cjs');
const H=createHarness(),cc=H.cc,B=H.load(path.join(H.BUNDLES,'board_art/journey_ui/JourneyPanels.ts')).createJourneyUi(H.load('ui/JourneyUi').journeyUiHost());
const {IslandJourneyOverlay}=H.load('world-r2/IslandJourneyOverlay'),{resetUiNightWeight}=H.load('ui/NightTint');
const MIN_GAP=8,TOL=0.6; // audit measures on device to 0.5 pt steps
function png(file){const b=fs.readFileSync(file);let i=8,w,h,ct,bd,plte=null,trns=null;const idat=[];
  while(i<b.length){const n=b.readUInt32BE(i),t=b.slice(i+4,i+8).toString(),d=b.slice(i+8,i+8+n);
    if(t==='IHDR'){w=d.readUInt32BE(0);h=d.readUInt32BE(4);bd=d[8];ct=d[9];}else if(t==='PLTE')plte=d;else if(t==='tRNS')trns=d;else if(t==='IDAT')idat.push(d);i+=12+n;}
  assert.equal(bd,8,'8-bit png');const bpp={2:3,3:1,6:4}[ct];assert(bpp,'colour type '+ct);const stride=w*bpp,raw=zlib.inflateSync(Buffer.concat(idat)),px=Buffer.alloc(h*stride);
  for(let y=0;y<h;y++){const f=raw[y*(stride+1)],o=y*(stride+1)+1;for(let x=0;x<stride;x++){const a=x>=bpp?px[y*stride+x-bpp]:0,bb=y?px[(y-1)*stride+x]:0,c=x>=bpp&&y?px[(y-1)*stride+x-bpp]:0;
    let p=raw[o+x];if(f===1)p+=a;else if(f===2)p+=bb;else if(f===3)p+=(a+bb)>>1;else if(f===4){const q=a+bb-c,pa=Math.abs(q-a),pb=Math.abs(q-bb),pc=Math.abs(q-c);p+=pa<=pb&&pa<=pc?a:pb<=pc?bb:c;}px[y*stride+x]=p&255;}}
  const rgba=(x,y)=>{const o=y*stride+x*bpp;if(ct===3){const k=px[o];return [plte[3*k],plte[3*k+1],plte[3*k+2],trns&&k<trns.length?trns[k]:255];}return [px[o],px[o+1],px[o+2],ct===6?px[o+3]:255];};
  return {w,h,rgba};}
// 1. paper inner edge from the art
const PS=B.PAPER_INNER_SRC,SL=[276,276,276,276],img=png(path.join(H.BUNDLES,'board_art/popup/panel_frame_9s.png'));
const lum=(x,y)=>{const [r,g,b2,a]=img.rgba(x,y);if(a<250)return 0;return (0.299*r+0.587*g+0.114*b2)/255;};
let rowsN=0;for(let y=SL[1];y<img.h-SL[3];y++){let L=-1,R=-1;for(let x=0;x<img.w;x++)if(lum(x,y)>=0.8){L=x;break;}for(let x=img.w-1;x>=0;x--)if(lum(x,y)>=0.8){R=x;break;}
  assert(L===PS.left,`row ${y}: paper starts at src ${L}, declared ${PS.left}`);assert(img.w-1-R===PS.right,`row ${y}: paper ends ${img.w-1-R} px from the right, declared ${PS.right}`);rowsN++;}
assert(PS.left-PS.right>=20,'the art is asymmetric (left bevel wider) — if it is ever re-exported symmetric, re-check this gate');
// 2./3. layout
const TARGET={'320x568':[57,267],'375x667':[64.5,315],'390x844':[73,321.5],'414x896':[87.5,331.5]};
const AUDIT_OLD={'320x568':[3,7],'375x667':[-2,2.5],'390x844':[-3,1.5],'414x896':[-5.5,-0.5]}; // summary.md §1 left/right gap, r4 @ fc3123fa
const box=(n,W,Hh)=>{const t=n.getComponent(cc.UITransform),p=n.worldPosition,s=n.worldScale,w=t.width*Math.abs(s.x);const cx=p.x+W/2;return {x0:cx-w*t.anchorX,x1:cx+w*(1-t.anchorX)};};
const gaps=(els,IN,ptPer)=>Object.fromEntries(Object.entries(els).flatMap(([k,b])=>[[k+'L',+((b.x0-IN.x0)/ptPer).toFixed(2)],[k+'R',+((IN.x1-b.x1)/ptPer).toFixed(2)]]));
const ok=g=>Object.values(g).every(v=>v>=MIN_GAP-0.01);
const rec=n=>Array.from({length:12},(_,i)=>({bestStars:i<n?1:0})),STAGES=Array.from({length:12},(_,i)=>({id:'r05-x-'+i,region:['tide','meadow','sky'][i%3]}));
(async()=>{const table=[];
for(const mode of ['day','night'])for(const [key,[t0,t1]] of Object.entries(TARGET)){const [W,Hh]=key.split('x').map(Number),tag=mode+'_'+key;
  globalThis.__worldDayNight={snapshot:()=>({mode})};resetUiNightWeight();
  const o=new IslandJourneyOverlay(cc._scene,{invoke:fn=>fn(),mainlineStatus:()=>({journey:{records:rec(0)}}),gates:()=>({r5:[],challenges:{},stages:STAGES}),enterRegion(){},enterR4(){},enterSkycity(){},returnHome(){},toggleDayNight(){},dayNight:()=>({mode})});
  await H.flush();o.sync(W,Hh,true);o.open('journal');const p=o.popups.find('JourneyPanel');assert(p,tag);for(let i=0;i<60;i++)o.update?.(1/30);
  const F=box(p.root.find('PanelFrame'),W,Hh),fu=(F.x1-F.x0)/p.width,ptPer=(F.x1-F.x0)/Math.min(330,Math.max(240,W-40));
  const IN={x0:F.x0+PS.left/PS.artPx*fu,x1:F.x1-PS.right/PS.artPx*fu};
  const nodes=p.root.getComponentsInChildren(cc.UITransform).map(t=>t.node),cells=nodes.filter(n=>n.name.startsWith('Chapter-')).map(n=>box(n,W,Hh));assert.equal(cells.length,9);
  const G={x0:Math.min(...cells.map(b=>b.x0)),x1:Math.max(...cells.map(b=>b.x1))},els={grid:G,card:box(nodes.find(n=>n.name.startsWith('Focus-')),W,Hh),bar:box(p.root.find('JourneyBar'),W,Hh)};
  const g=gaps(els,IN,ptPer);assert(ok(g),tag+' content < 8 pt inside the paper '+JSON.stringify(g));
  // the harness pose may still carry the popup's open scale (ptPer ≠ 1 around the screen centre): map to the settled screen pt
  const S=x=>W/2+(x-W/2)/ptPer;
  for(const [k,b0] of Object.entries(els)){const b={x0:S(b0.x0),x1:S(b0.x1)};assert(Math.abs(b.x0-t0)<=TOL&&Math.abs(b.x1-t1)<=TOL,`${tag} ${k} ${b.x0.toFixed(2)}–${b.x1.toFixed(2)} vs audit target ${t0}–${t1}`);}
  // r4 layout (negative self-test)
  const cx=(F.x0+F.x1)/2,hw=(F.x1-F.x0)/2-(24+8)*ptPer,OLD={x0:cx-hw,x1:cx+hw},go=gaps({grid:OLD},IN,ptPer);
  assert(!ok(go),tag+' negative self-test: the r4 layout must FAIL '+JSON.stringify(go));
  assert(Math.abs(go.gridL-AUDIT_OLD[key][0])<=0.75&&Math.abs(go.gridR-AUDIT_OLD[key][1])<=0.75,tag+' r4 gaps '+JSON.stringify(go)+' vs device '+AUDIT_OLD[key]);
  table.push({tag,paper:[+S(IN.x0).toFixed(2),+S(IN.x1).toFixed(2)],r5:[+S(G.x0).toFixed(2),+S(G.x1).toFixed(2)],r5gap:[g.gridL,g.gridR],target:[t0,t1],r4:[+S(OLD.x0).toFixed(2),+S(OLD.x1).toFixed(2)],r4gap:[go.gridL,go.gridR]});
  o.dispose();}
delete globalThis.__worldDayNight;
console.log('JOURNEY_PAPER_R5 '+JSON.stringify(table));
console.log(`PASS paper inner edge src ${PS.left}/${PS.right} px re-derived on ${rowsN} middle rows of panel_frame_9s.png`);
console.log(`PASS bar + focus card + grid ≥${MIN_GAP} pt inside the paper and within ${TOL} pt of the audit targets on ${table.length} combos (4 widths × day/night)`);
console.log(`PASS negative self-test: r4 layout fails on all ${table.length} combos and reproduces the device gaps within 0.75 pt`);
})().catch(e=>{console.error(e);process.exit(1);});
