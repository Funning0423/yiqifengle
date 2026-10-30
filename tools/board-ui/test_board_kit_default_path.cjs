'use strict';
/* board-kit-default-path (coast-kit-int, Grok Bot 10/30 condition 2): with the coast kit OFF (no ?qfcoastkit=1) the board renders
 * byte-for-byte like the base. Method (what the box can produce — no WebGL): the REAL ManagedMobileBoardUI at the base commit
 * (git show BASE:…, loaded beside the current file so imports resolve) and the current one are each mounted on the board-ui
 * harness for the island board (mainline-v33) and the meadow board (regional-r05, region 'meadow') on all 7 screens; render output =
 * the full UI node tree (name, active, position, scale, size, anchor, sprite texture + size, sprite colour/type, Graphics ops,
 * Label text/size/colour, opacity) + the tap lookup (cellAt, both y axes, every 3 pt across the screen). SHA-256 of both must be equal
 * per board/screen: 0 differences, fallback = 0. Self-check: the base copy with one cell moved by 1 pt must differ. */
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process'),crypto=require('node:crypto');
const {createHarness}=require('./harness.cjs'),{createBoard,snapshot}=require('./board-fixture.cjs');
const ROOT=path.resolve(__dirname,'../..'),REL='creator-build-project/assets/scripts/ManagedMobileBoardUI.ts',CUR=path.join(ROOT,REL);
const BASE='ec9bd651'/* ggbot/board-kit-p1 head before the wiring; same blob as candidate 571b6af6 */;
const git=a=>cp.execFileSync('git',a,{cwd:ROOT,encoding:'utf8',maxBuffer:64<<20});
const baseSrc=git(['show',BASE+':'+REL]);assert.equal(git(['rev-parse',BASE+':'+REL]),git(['rev-parse','571b6af6:'+REL]),'base blob = 571b6af6');
const SCREENS=[[390,844],[414,896],[360,780],[375,667],[320,568],[390,520],[768,1024]];
function dump(b,w,h){const out=[];const walk=(n,d)=>{const r=[d,n.name,n.active,n.position&&[n.position.x,n.position.y],n.scale&&[n.scale.x,n.scale.y],n.angle];
  for(const c of n.components){const k=c.constructor.name,e=[k];
   if(c.contentSize)e.push(c.contentSize.width,c.contentSize.height,c.anchorX,c.anchorY);if(k==='UITransform'&&c.width!==undefined)e.push(c.width,c.height);
   if('spriteFrame' in c){const f=c.spriteFrame,i=f&&f.texture&&f.texture.image;e.push(f?[f.originalSize.width,f.originalSize.height,i&&(i.src||i.url||i.path||i.name)||null]:null,c.type,c.sizeMode,c.color&&[c.color.r,c.color.g,c.color.b,c.color.a]);}
   if(c.ops)e.push(JSON.stringify(c.ops));if('string' in c)e.push(c.string,c.fontSize,c.color&&[c.color.r,c.color.g,c.color.b,c.color.a]);if('opacity' in c)e.push(c.opacity);r.push(e);}
  out.push(JSON.stringify(r));for(const ch of n.children)walk(ch,d+1);};walk(b.u.root,0);
 const cellAt=Object.getPrototypeOf(b.u).cellAt;for(let y=0;y<h;y+=3){let row='';for(let x=0;x<w;x+=3)row+=cellAt.call(b.u,x,y,false)+','+cellAt.call(b.u,x,y,true)+';';out.push(row);}
 return out;}
async function render(uiFile,provider,w,h){const H=createHarness();const s=snapshot(provider,provider==='regional-r05'?1:0);if(provider==='regional-r05')s.active.region='meadow';
 const b=createBoard({harness:H,uiModule:uiFile,provider,snapshot:s,width:w,height:h});await H.flush();b.render();b.u.update(0);await H.flush();b.u.update(1/30);return dump(b,w,h);}
const tmp=n=>path.join(path.dirname(CUR),'ManagedMobileBoardUI.'+n+'.gatetmp.ts');
const hash=a=>crypto.createHash('sha256').update(a.join('\n')).digest('hex');
(async()=>{const fBase=tmp('base'),fBad=tmp('selfcheck');let diffs=0,cases=0;const lines=[];
 try{fs.writeFileSync(fBase,baseSrc);const bad=baseSrc.replace('n.setPosition(c.x - g.grid.x, g.grid.y - c.y, 0);','n.setPosition(c.x + 1 - g.grid.x, g.grid.y - c.y, 0);');assert.notEqual(bad,baseSrc,'self-check injection point');fs.writeFileSync(fBad,bad);
  {const a=await render(fBase,'mainline-v33',390,844),c=await render(fBad,'mainline-v33',390,844);assert.notEqual(hash(a),hash(c),'self-check: a 1 pt cell move was NOT detected');console.log('ok   self-check: base with one 1 pt cell move → hash differs');}
  for(const prov of ['mainline-v33','regional-r05'])for(const [w,h] of SCREENS){const a=await render(fBase,prov,w,h),c=await render(CUR,prov,w,h);cases++;const ha=hash(a),hc=hash(c);
   if(ha!==hc){diffs++;const i=a.findIndex((x,j)=>x!==c[j]);lines.push(`DIFF ${prov==='mainline-v33'?'island':'meadow'} ${w}x${h} first at line ${i}: ${String(a[i]).slice(0,160)} ≠ ${String(c[i]).slice(0,160)}`);}
   else lines.push(`ok   ${prov==='mainline-v33'?'island':'meadow'} ${w}x${h}: ${a.length} lines, sha256 ${ha.slice(0,12)} = base`);}
 }finally{for(const f of [fBase,fBad])try{fs.unlinkSync(f);}catch{}}
 for(const l of lines)console.log(l);const fb=(globalThis.__qfBoardKitFallback||{count:0}).count;
 console.log(`board-kit-default-path: ${cases} boards (island + meadow × 7 screens), ${diffs} differences vs ${BASE}, fallback=${fb}`);
 if(diffs||fb){console.log('board-kit-default-path: FAIL');process.exit(1);}console.log('board-kit-default-path: PASS');
})().catch(e=>{console.error('FAIL',e&&e.stack||e);for(const n of ['base','selfcheck'])try{fs.unlinkSync(tmp(n));}catch{}process.exit(1);});
