'use strict';
// Drive the REAL LandmarkAudioCore (transpiled from the worktree) along a walk path; dump per-voice volume timelines.
const fs=require('fs'),path=require('path'),Module=require('module'),cp=require('child_process');
const ts=require('/tmp/qfts/node_modules/typescript');
const [,,root,scenario,nightArg,seedArg,outFile]=process.argv;
const base=path.join(root,'creator-build-project/assets/scripts'),cache={};
function load(file){if(cache[file])return cache[file].exports;const m=new Module(file);cache[file]=m;
 m.require=id=>id==='cc'?{}:load(path.normalize(path.join(path.dirname(file),id+'.ts')));
 m._compile(ts.transpileModule(fs.readFileSync(path.join(base,file),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES5}}).outputText,file);return m.exports;}
const {LandmarkAudioCore}=load('audio/LandmarkAudioCore.ts');const {CONFIRMED_LANDMARKS}=load('audio/SceneAudioTable.ts');
const bundles=path.join(root,'creator-build-project/assets/bundles');
const dur={};function clipDur(c){const f=path.join(bundles,c.bundle,c.path+'.mp3');if(!(f in dur))dur[f]=+cp.execFileSync('ffprobe',['-v','error','-show_entries','format=duration','-of','csv=p=0',f]).toString();return dur[f];}
let s=+seedArg||1;const rnd=()=>{s=(s*16807)%2147483647;return (s-1)/2147483646;};
// geometry (scene-local metres; ducks from scene_r5h_slim_transforms.json, sky from env_skycity.glb, walk nodes from LakesideRegionNodes / RegionNodes)
const A={lakeWaterbirds:[-6,0.005,5.6],skyGardener:[3.6,0.05,28.2],skyStarring:[0.05,20.05,-23.95]};
const P={
 lake:{place:'lakeside',T:60,legs:[[[1.2,.58,36],6],[[1.2,.58,24.5]],[[-3,.5,14]],[[-3,.5,14],15],[[1.2,.58,36]]]},
 gardener:{place:'skycity',T:60,legs:[[[5.4,-.1,43.8],2],[[5.4,-.09,37]],[[5.8,-.1,35.8]],[[5,.14,35]],[[0.2,.04,30.2]],[[0.2,.04,30.2],22],[[0.2,.04,26.2]],[[-2.6,.17,23.4]],[[-6.6,-.05,19.4]],[[-6.6,-.05,19.4],20]]},
 starring:{place:'skycity',T:60,legs:[[[0.2,3.31,-5.8],3],[[0.2,2.33,-4.6]],[[2.6,.33,-2.2]],[[3,-.01,-2.6]],[[3,-.02,-14.2]],[[0.2,.08,-17]],[[0.2,.03,-27.8]],[[0.2,.03,-27.8],12],[[0.2,.08,-17]],[[3,-.02,-14.2]],[[3,-.01,-2.6]],[[2.6,.33,-2.2]],[[0.2,3.31,-5.8],30]]}}[scenario];
// expand path into (t,pos) at 1.2 m/s
const pts=[];let t=0,cur=P.legs[0][0];pts.push([0,cur]);
for(const [p,hold] of P.legs){const d=Math.hypot(p[0]-cur[0],p[1]-cur[1],p[2]-cur[2]);if(d>0){t+=d/1.2;pts.push([t,p]);cur=p;}if(hold){t+=hold;pts.push([t,p]);}}
function posAt(x){for(let i=1;i<pts.length;i++)if(x<=pts[i][0]){const [t0,a]=pts[i-1],[t1,b]=pts[i],u=t1>t0?(x-t0)/(t1-t0):1;return a.map((v,k)=>v+(b[k]-v)*u);}return pts[pts.length-1][1];}
const dt=1/30,night=+nightArg||0,events=[],frames=[];
const voices={};
const core=new LandmarkAudioCore(spec=>{const v={ready:false,playing:false,volume:0,idx:-1,start:-1,spec,
 prepare(i){this.idx=i;this.ready=true;},play(loop){this.playing=true;this.loop=loop;this.start=now;events.push({t:now,id:spec.id,ev:'play',clip:spec.clips[this.idx].path,loop});},
 release(){if(this.start>=0)events.push({t:now,id:spec.id,ev:'release'});this.ready=false;this.playing=false;this.volume=0;this.start=-1;}};voices[spec.id]=v;return v;},rnd,CONFIRMED_LANDMARKS);
let now=0;
for(let i=0;now<P.T;i++){now=i*dt;
 for(const id in voices){const v=voices[id];if(v.playing&&!v.loop&&now-v.start>=clipDur(v.spec.clips[v.idx]))v.playing=false;}
 const g=posAt(now),d={};for(const id in A)d[id]=Math.hypot(g[0]-A[id][0],g[1]-A[id][1],g[2]-A[id][2]);
 core.step(dt,P.place,d,true,1,night);
 frames.push({t:+now.toFixed(4),d:Object.fromEntries(Object.entries(d).map(([k,v])=>[k,+v.toFixed(2)])),vol:Object.fromEntries(Object.entries(voices).map(([k,v])=>[k,+v.volume.toFixed(5)]))});}
fs.writeFileSync(outFile,JSON.stringify({scenario,night,specs:CONFIRMED_LANDMARKS.map(s=>({id:s.id,vol:s.vol,nearM:s.nearM,farM:s.farM,interval:s.interval||null})),events,frames}));
const mind={};for(const f of frames)for(const k in f.d)mind[k]=Math.min(mind[k]??1e9,f.d[k]);
const maxv={};for(const f of frames)for(const k in f.vol)maxv[k]=Math.max(maxv[k]??0,f.vol[k]);
console.log(scenario,'night',night,'minDist',JSON.stringify(mind),'maxVol',JSON.stringify(maxv),'plays',events.filter(e=>e.ev==='play').map(e=>e.t.toFixed(1)+':'+e.clip.split('/').pop()).join(' '));
