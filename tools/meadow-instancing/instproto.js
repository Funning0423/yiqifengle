/* 注入到 web 构建（?snowshot=1 入口，路由替换 snowshot.js）。测 方案 R：读取 → 展开 → 建 cc.Mesh 的耗时与内存。
 * ?mode=sync|chunk  sync=一帧内全部展开+建网格；chunk=每帧一个网格（分帧）。结果写到 window.__snow */
(async function(){
const q=new URLSearchParams(location.search),mode=q.get('mode')||'sync';const S=window.__snow={ready:false,log:[],mode,il:q.get('il')==='1'};
const {director,Scene,Node,Camera,MeshRenderer,Material,utils,gfx,Color}=cc;
const mem=()=>performance.memory?performance.memory.usedJSHeapSize:0;let peak=0;const samp=setInterval(()=>{peak=Math.max(peak,mem());},1);
const sc=new Scene('inst');director.runSceneImmediate(sc);const cn=new Node('cam');sc.addChild(cn);cn.addComponent(Camera);cn.setPosition(0,20,60);
await new Promise(r=>setTimeout(r,500));if(window.gc)window.gc();
const m0=mem();peak=m0;
let t=performance.now();const buf=await (await fetch('inst/inst_meadow.qfi.raw')).arrayBuffer();S.fetchMs=performance.now()-t;S.bytes=buf.byteLength;
const mat=new Material();mat.initialize({effectName:'builtin-unlit'});
const frames=[];const one=(m)=>{const a=performance.now();
  const g={positions:m.positions,indices:m.indices,minPos:{x:m.minPos[0],y:m.minPos[1],z:m.minPos[2]},maxPos:{x:m.maxPos[0],y:m.maxPos[1],z:m.maxPos[2]}};
  if(m.attrs.NORMAL)g.normals=m.attrs.NORMAL;if(m.attrs.TEXCOORD_0)g.uvs=m.attrs.TEXCOORD_0;if(m.attrs.COLOR_0)g.colors=m.attrs.COLOR_0;
  if(m.attrs.TEXCOORD_1)g.customAttributes=[{attr:new gfx.Attribute('a_texCoord1',gfx.Format.RG32F),values:m.attrs.TEXCOORD_1}];
  let mesh;if(q.get('il')==='1'){const r=interleaveQfiMesh(m,gfx);mesh=new cc.Mesh();mesh.reset(r);}else mesh=utils.MeshUtils.createMesh(g);const n=new Node(m.name);sc.addChild(n);const r=n.addComponent(MeshRenderer);r.mesh=mesh;r.setMaterial(mat,0);
  return performance.now()-a;};
t=performance.now();
if(mode==='sync'){const e0=performance.now();const ms=expandQfi(buf);S.expandMs=performance.now()-e0;let c=0;for(const m of ms)c+=one(m);S.createMs=c;S.totalSyncMs=performance.now()-t;S.maxFrameMs=S.totalSyncMs;}
else{const cnt=expandQfi(buf,-1).count;S.expandMs=0;
  for(let i=0;i<cnt;i++){await new Promise(r=>requestAnimationFrame(r));const a=performance.now();const m=expandQfi(buf,i)[0];const e=performance.now()-a;S.expandMs+=e;frames.push(e+one(m));}S.frames=frames;S.maxFrameMs=Math.max(...frames);S.totalWorkMs=frames.reduce((a,b)=>a+b,0);}
await new Promise(r=>setTimeout(r,300));clearInterval(samp);S.heapBefore=m0;S.heapPeak=peak;S.heapAfter=mem();S.peakDeltaMB=(peak-m0)/1048576;S.retainedMB=(S.heapAfter-m0)/1048576;
S.ready=true;console.log('[inst]',JSON.stringify(S));})();
