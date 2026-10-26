#!/usr/bin/env node
'use strict';
/**
 * Golden re-baseline for the SailVoyage lens. Usage:
 *   node tools/sail-voyage/rebaseline.cjs --dry-run          # no PNGs: show what would change and which assertions fail
 *   node tools/sail-voyage/rebaseline.cjs <capture dir>      # Mac ENGINE PNGs per capture-spec.json → commit + comparison image
 * Only frames / gold poses are replaced; no threshold is edited. If any golden test then fails, it stops (no commit) and
 * prints the failing assertion so Grok Bot can decide — it never loosens a limit.
 */
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process');
const ROOT=path.resolve(__dirname,'../..'),SPEC=require('./capture-spec.json'),dry=process.argv.includes('--dry-run'),dir=process.argv.slice(2).find(a=>!a.startsWith('--'));
if(!dry&&!dir){console.error('capture dir required (or --dry-run)');process.exit(2);}
const L=require('../transitions/sail_farsea_lib.cjs'),leg=L.leg;
const SV=L.load('region/SailVoyage.ts',()=>({...leg}));SV.SAIL_VOYAGE.enabled=true;/* for the new gold poses only */
const route=leg.sailRoute(),tl=leg.sailBeats(route.length);
// 1. frames present (engine captures, old + new)
const need=[];for(const f of SPEC.frames){const ts=Array.isArray(f.t)?f.t:[f.t];const scr=f.screens==='all'?SPEC.screens:f.screens;for(const t of ts)for(const s of scr)for(const w of ['old','new'])need.push(`${f.id}${Array.isArray(f.t)?t:''}_${s}_${w}.png`);}
if(!dry){const miss=need.filter(n=>!fs.existsSync(path.join(dir,n)));if(miss.length){console.error('missing '+miss.length+' frames, e.g. '+miss.slice(0,5).join(', '));process.exit(3);}}
// 2. new gold poses (sail-farsea GOLD) from the live voyage lens at the same times
const farsea=path.join(ROOT,'tools/transitions/test_sail_farsea.cjs'),k2k7=path.join(ROOT,'tools/transitions/test_sail_k2k7.cjs');
const src=fs.readFileSync(farsea,'utf8'),m=/const GOLD=(\{.*?\});\n/s.exec(src);const OLD=eval('('+m[1].replace(/tl\.build05S/g,String(tl.build05S))+')');
const r4=x=>+x.toFixed(4),NEW={};for(const [k,g] of Object.entries(OLD)){const c=SV.sailVoyageCamera(tl,route.samples,g.t);NEW[k]={t:g.t,p:c.position.map(r4),q:c.target.map(r4),f:c.fovVerticalDeg};}
const goldLine='const GOLD='+JSON.stringify(NEW).replace(/"(\w+)":/g,'$1:').replace(/t:23\.70\d+/,'t:tl.build05S-0.12')+';\n';
// 3. the golden tests pick the live lens themselves (SailVoyage when enabled) and switch their content checks with it
//    (Grok Bot 2026-10-26: farsea windmill → pre-docking 19.5–20.5 s + mid-sea 'no island, horizon'; k2k7 K2 → stern + near wake)
const nf=src.replace(m[0],goldLine),k2=fs.readFileSync(k2k7,'utf8'),nk=k2;
const voyage=path.join(ROOT,'creator-build-project/assets/scripts/region/SailVoyage.ts'),vs=fs.readFileSync(voyage,'utf8'),nv=vs.replace('enabled:voyageQuery(),','enabled:true,');
// 4. run the patched golden tests in a scratch copy
const tmp=fs.mkdtempSync('/tmp/sv-rebase-');cp.execFileSync('git',['worktree','add','--detach',tmp,'HEAD'],{cwd:ROOT,stdio:'ignore'});
const res={};try{
 fs.writeFileSync(path.join(tmp,'tools/transitions/test_sail_farsea.cjs'),nf);fs.writeFileSync(path.join(tmp,'tools/transitions/test_sail_k2k7.cjs'),nk);fs.writeFileSync(path.join(tmp,'creator-build-project/assets/scripts/region/SailVoyage.ts'),nv);
 for(const [n,f] of [['sail-farsea','tools/transitions/test_sail_farsea.cjs'],['sail-k2k7','tools/transitions/test_sail_k2k7.cjs']]){const r=cp.spawnSync('node',[f],{cwd:tmp,encoding:'utf8',env:process.env});res[n]=r.status===0?'PASS':'FAIL: '+((r.stderr||'').match(/AssertionError[^\n]*|Error: [^\n]*/)||[''])[0].slice(0,200);}
}finally{cp.execFileSync('git',['worktree','remove','--force',tmp],{cwd:ROOT,stdio:'ignore'});}
console.log(JSON.stringify({dry,frames:need.length,oldGold:OLD,newGold:NEW,patchedTests:res},null,1));
if(dry){console.error(Object.values(res).every(x=>x==='PASS')?'dry run: golden tests pass on the new lens; a real run still needs all engine PNGs':'dry run: golden tests FAIL on the new lens');process.exit(Object.values(res).every(x=>x==='PASS')?0:4);}
if(Object.values(res).some(x=>x!=='PASS')){console.error('golden test fails on the new lens → no commit; needs Grok Bot (thresholds are not edited here)');process.exit(4);}
// 5. comparison image old | new per frame, then the commit
const cmp=path.join(ROOT,'tools/sail-voyage/reports/rebaseline-compare.png');
cp.execFileSync('python3',['-c',`import sys,glob,os
from PIL import Image,ImageDraw
d=sys.argv[1];rows=[]
for o in sorted(glob.glob(os.path.join(d,'*_old.png'))):
  n=o[:-8]+'_new.png';a=Image.open(o).convert('RGB');b=Image.open(n).convert('RGB');h=240;a=a.resize((int(a.width*h/a.height),h));b=b.resize((int(b.width*h/b.height),h))
  r=Image.new('RGB',(a.width+b.width+8,h+14),'white');r.paste(a,(0,14));r.paste(b,(a.width+8,14));ImageDraw.Draw(r).text((2,1),os.path.basename(o)[:-8]+'  old | new',fill='black');rows.append(r)
W=max(r.width for r in rows);out=Image.new('RGB',(W,sum(r.height for r in rows)),'white');y=0
for r in rows:out.paste(r,(0,y));y+=r.height
out.save(sys.argv[2])`,dir,cmp]);
fs.writeFileSync(farsea,nf);fs.writeFileSync(voyage,nv);
const g=(...a)=>cp.execFileSync('git',['-c','user.name=运镜bot','-c','user.email=yunjing-bot@local',...a],{cwd:ROOT,stdio:'inherit'});
g('add',farsea,voyage,cmp);g('commit','-m','sail-voyage: golden re-baseline from Mac engine frames ('+path.basename(dir)+')，只替换帧、阈值未动；SailVoyage 默认开启');
