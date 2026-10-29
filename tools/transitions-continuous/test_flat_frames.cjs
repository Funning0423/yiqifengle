'use strict';
// full9c flat-frame gate: the checker (flat_frames.py) must catch 2 consecutive flat (std<10) transition frames, accept 1,
// and ignore flat frames outside transitions. Synthetic sequences; the Mac runs the same checker on the real shots/.
const cp=require('node:child_process'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const C=path.join(__dirname,'flat_frames.py');
const mk=`import sys,os
from PIL import Image
d=sys.argv[1];os.makedirs(d,exist_ok=True)
def tex(n):
  im=Image.new('L',(78,169));im.putdata([(x*37+y*11)%255 for y in range(169) for x in range(78)]);im.save(os.path.join(d,n))
def flat(n):Image.new('L',(78,169),196).save(os.path.join(d,n))
for spec in sys.argv[2].split(','):
  i,kind,tr=spec.split(':');n=f"{i}-{'tr-region-travel' if tr=='t' else 'level'}.png";(flat if kind=='f' else tex)(n)`;
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'flat-'));
const run=(name,spec)=>{const d=path.join(tmp,name);const g=cp.spawnSync('python3',['-c',mk,d,spec],{encoding:'utf8'});
 if(g.status!==0)return {blocked:g.stderr};const r=cp.spawnSync('python3',[C,d],{encoding:'utf8'});return {code:r.status,out:r.stdout.trim()};};
const one=run('one','1:t:t,2:f:t,3:t:t,4:f:t,5:t:t'),two=run('two','1:t:t,2:f:t,3:f:t,4:t:t'),off=run('off','1:t:t,2:f:n,3:f:n,4:f:n,5:t:t');
fs.rmSync(tmp,{recursive:true,force:true});
if(one.blocked||two.blocked||off.blocked){console.log('flat-frames: BLOCKED (python3/PIL) '+(one.blocked||'').slice(0,200));process.exit(0);}
console.log(JSON.stringify({one,two,off}));
if(one.code!==0)throw new Error('single flat transition frame must pass');
if(two.code!==1)throw new Error('2 consecutive flat transition frames must fail');
if(off.code!==0)throw new Error('flat frames outside transitions are not counted');
console.log('flat-frames: PASS');
