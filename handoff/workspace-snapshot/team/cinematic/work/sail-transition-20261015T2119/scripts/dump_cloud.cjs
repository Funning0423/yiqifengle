// Dumps per-frame cover + puff alpha from the game's own TS modules (no reimplementation).
const fs=require('fs'),path=require('path');const {stripTypeScriptTypes}=require('node:module');
const root=process.argv[2];const S=p=>path.join(root,'creator-build-project/assets/scripts/cine',p);
const load=(f,names)=>new Function(stripTypeScriptTypes(fs.readFileSync(S(f),'utf8').replace(/^import .*$/gm,'').replace(/^export /gm,''),{mode:'transform'})+'\nreturn {'+names+'};')();
const M=load('SailboatTransitionModel.ts','parseSailboatTiming,createSailboatPlayback,sailboatCoverAlpha');
const L=load('SailboatCloudLayout.ts','SAILBOAT_CLOUD_PUFFS,cloudShownAlpha,cloudBankCovers');
const T=load('SailboatCloudTexture.ts','sailboatCloudPixels,puffDissolveAlpha,puffPlacement,cloudNightTint,SAILBOAT_CLOUD_TEX_SIZE');
const timing=M.parseSailboatTiming(JSON.parse(fs.readFileSync(path.join(root,'creator-build-project/assets/resources/cine/transition_island_to_meadow.timing.json'),'utf8')));
const pb=M.createSailboatPlayback(timing,{startFov:42});let s=pb.begin();const frames=[];
let far=0;for(const p of L.SAILBOAT_CLOUD_PUFFS)far=Math.max(far,Math.hypot(p[0],p[1]));
let time=0;
for(let f=0;f<=timing.lastFrame+15;f++){
  const v=s.view;const cover=M.sailboatCoverAlpha(v);const shown=L.cloudShownAlpha(cover);
  if(shown>1/255)time+=1/30;
  frames.push({f,frame:v.frame,phase:v.phase,cover,shown,swapped:v.swapped,meadowBlend:v.meadowBlend,departure:v.departure,
    puffs:L.SAILBOAT_CLOUD_PUFFS.map((p,i)=>{const a=T.puffDissolveAlpha(shown,p[6]);const at=T.puffPlacement(p[0]+Math.sin(time*0.35+i*0.7)*0.03,p[1],p[2],a);return {x:at.x,y:at.y,s:at.scale,rgb:[p[3],p[4],p[5]],rgbn:T.cloudNightTint([p[3],p[4],p[5]],1),tex:i%3,a};})});
  s=pb.advance(1/30,{meadowReady:true});
}
fs.writeFileSync(process.argv[3]+'/cloud_frames.json',JSON.stringify({timing:{fps:timing.fps,lastFrame:timing.lastFrame,cloud:timing.cloud,sceneSwapFrame:timing.sceneSwapFrame,shots:timing.shots,skipEnabledFromFrame:timing.skipEnabledFromFrame,skipFadeSec:timing.skipFadeSec},frames}));
const n=T.SAILBOAT_CLOUD_TEX_SIZE;[11,23,37].forEach((seed,i)=>fs.writeFileSync(process.argv[3]+'/tex'+i+'.rgba',Buffer.from(T.sailboatCloudPixels(n,seed))));
console.log('frames',frames.length,'done at',frames.findIndex(x=>x.phase==='done'));
