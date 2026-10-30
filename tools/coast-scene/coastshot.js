// 海岸 A 潮池礁盘 — Cocos 3.8.8 engine shot (runtime-built from coast_meshes.json / coast_layout.json). ?coastshot=1[&nopieces=1][&cam=game|close_beacon|close_edge|close_conch][&t=sec]
(function(){
const q=new URLSearchParams(location.search);const S=window.__coast={ready:false,log:[]};const L=(...a)=>{S.log.push(a.join(' '));console.log('[coast]',...a);};
const {director,Scene,Node,Camera,DirectionalLight,MeshRenderer,Material,Vec3,Color,Quat,utils}=cc;
const NOP=q.get('nopieces')==='1',CAM=q.get('cam')||'game';
const mats={};
function mat(kind,alpha){const key=kind+alpha;if(mats[key])return mats[key];const m=new Material();
  if(kind==='unlit'){m.initialize({effectName:'builtin-unlit',technique:alpha<1?1:0,defines:{USE_VERTEX_COLOR:true}});}
  else{m.initialize({effectName:'builtin-standard',technique:alpha<1?1:0,defines:{USE_VERTEX_COLOR:true}});m.setProperty('roughness',kind==='water'?0.55:kind==='piece'?0.42:0.88);m.setProperty('metallic',0);
       m.setProperty('mainColor',new Color(255,255,255,255));}
  return mats[key]=m;}
const MESHES={},DATA={};
function mkMesh(name){if(MESHES[name])return MESHES[name];const d=DATA[name];const cols=new Array(d.colors.length);for(let i=0;i<cols.length;i++)cols[i]=(i%4===3)?d.colors[i]/255:Math.pow(d.colors[i]/255,2.2);
  const n=d.positions.length/3,idx=new Array(n);for(let i=0;i<n;i++)idx[i]=i;
  return MESHES[name]=utils.MeshUtils.createMesh({positions:d.positions,normals:d.normals,colors:cols,indices:idx});}
function inst(parent,e){const d=DATA[e.mesh];if(!d){L('missing',e.mesh);return null;}const n=new Node(e.mesh);parent.addChild(n);n.setPosition(e.p[0],e.p[1],e.p[2]);
  n.setRotationFromEuler(e.tilt?e.tilt[0]:0,e.rz*180/Math.PI,e.tilt?e.tilt[1]:0);n.setScale(e.s,e.s,e.s);const r=n.addComponent(MeshRenderer);r.mesh=mkMesh(e.mesh);
  const kind=d.unlit||d.emit||e.mesh==='reuse_cloud'?'unlit':e.piece?'piece':'std';r.setMaterial(mat(kind,d.alpha),0);
  r.shadowCastingMode=(e.cast_shadow||e.piece||/^rock_|ebb_bell|crab|gull|hermit|headland|beacon_post|reuse_palm|reuse_bush/.test(e.mesh))&&!d.unlit?1:0;
  r.receiveShadow=(e.receive_shadow===false||d.unlit)?0:1;n.__e=e;n.__base=n.position.clone();n.__rot=n.rotation.clone();return n;}
// ---- water: dynamic grid, transparent so the turquoise shelf shows through; fresnel + sparkle by vertex colour ----
let water=null,wpos=null,wcol=null,WX=72,WZ=110,SH=5.2;
function buildWater(parent,shore){SH=shore;const P=[],C=[],I=[],N=[];const x0=-34,x1=34,z0=-(shore-2.5),z1=-(shore+150);
  for(let j=0;j<=WZ;j++)for(let i=0;i<=WX;i++){const u=i/WX,v=Math.pow(j/WZ,1.9);P.push(x0+(x1-x0)*u,-0.075,z0+(z1-z0)*v);N.push(0,1,0);C.push(0.12,0.55,0.82,0.7);}
  for(let j=0;j<WZ;j++)for(let i=0;i<WX;i++){const a=j*(WX+1)+i,b=a+1,c=a+WX+1,d=c+1;I.push(a,c,b,b,c,d);}
  {const bp=[x0*3,-1.3,-(shore+6),x1*3,-1.3,-(shore+6),x0*3,-1.3,-(shore+160),x1*3,-1.3,-(shore+160)],bc=[0.018,0.24,0.50,1,0.018,0.24,0.50,1,0.014,0.2,0.45,1,0.014,0.2,0.45,1];const bn=new Node('seabed');parent.addChild(bn);const br=bn.addComponent(MeshRenderer);
   br.mesh=utils.MeshUtils.createMesh({positions:bp,normals:[0,1,0,0,1,0,0,1,0,0,1,0],colors:bc,indices:[0,1,2,1,3,2]});br.setMaterial(mat('rock',1),0);br.shadowCastingMode=0;br.receiveShadow=0;}
  wpos=P;wcol=C;const n=new Node('water');parent.addChild(n);const r=n.addComponent(MeshRenderer);
  r.mesh=utils.MeshUtils.createDynamicMesh(0,{positions:new Float32Array(P),normals:new Float32Array(N),colors:new Float32Array(C),indices:new Uint16Array(I)},undefined,{maxSubMeshes:1,maxSubMeshVertices:P.length/3,maxSubMeshIndices:I.length});
  r.setMaterial(mat('water',0.7),0);r.shadowCastingMode=0;r.receiveShadow=0;water={r,I,N:new Float32Array(N)};}
function waterAt(t,camPos){const P=wpos,C=wcol,n=P.length/3,pos=new Float32Array(P.length),col=new Float32Array(C.length),nor=water.N;
  for(let k=0;k<n;k++){const x=P[3*k],z=P[3*k+2];const h=0.045*Math.sin(x*0.55+z*0.9+t*1.4)+0.03*Math.sin(-x*1.1+z*0.35+t*2.1)+0.015*Math.sin(x*2.3+z*1.9+t*3.3);
    pos[3*k]=x;pos[3*k+1]=-0.075+h;pos[3*k+2]=z;
    const dx=0.045*0.55*Math.cos(x*0.55+z*0.9+t*1.4)-0.03*1.1*Math.cos(-x*1.1+z*0.35+t*2.1),dz=0.045*0.9*Math.cos(x*0.55+z*0.9+t*1.4)+0.03*0.35*Math.cos(-x*1.1+z*0.35+t*2.1);
    let nx=-dx,ny=1,nz=-dz,l=Math.hypot(nx,ny,nz);nx/=l;ny/=l;nz/=l;nor[3*k]=nx;nor[3*k+1]=ny;nor[3*k+2]=nz;
    const vx=camPos.x-x,vy=camPos.y-pos[3*k+1],vz=camPos.z-z,vl=Math.hypot(vx,vy,vz);const cosv=Math.max(0,(vx*nx+vy*ny+vz*nz)/vl);const fr=Math.pow(1-cosv,4);
    const far=Math.min(1,(-z-6)/40);const sp=Math.pow(Math.max(0,Math.sin(x*3.1+t*2.0)*Math.sin(z*2.7-t*1.7)),18)*0.8*Math.max(0,1-far*4);
    const d=-z-SH;const band=d<2.2?0:d<6?1:2;const BB=[[0.18,0.78,0.80],[0.05,0.58,0.78],[0.03,0.44,0.76],[0.01,0.24,0.60]];const w=band<2?0:Math.min(1,Math.max(0,(d-6)/45));const BC=band<2?BB[band]:BB[2].map((v,i)=>v*(1-w)+BB[3][i]*w);
    const fl=(d>1.5&&d<16)?Math.pow(Math.max(0,Math.sin(d*0.9-t*1.3+0.6*Math.sin(x*0.25))),40)*(0.5+0.5*Math.sin(x*0.7+d)):0;
    const hz=Math.min(1,Math.max(0,(d-40)/90));const nn=0.03*Math.sin(x*0.13+d*0.21)*Math.sin(d*0.09-x*0.05);col[4*k]=Math.min(1,BC[0]+0.12*fr+sp+0.9*fl+0.10*hz+nn);col[4*k+1]=Math.min(1,BC[1]+0.1*fr+sp+0.5*fl+0.22*hz+2*nn);col[4*k+2]=Math.min(1,BC[2]+0.06*fr+sp+0.3*fl+0.18*hz+nn);col[4*k+3]=Math.min(1,(band<1?0.55:0.82+0.06*band)+0.2*fr+fl);}
  water.r.mesh.updateSubMesh(0,{positions:pos,normals:nor,colors:col,indices:new Uint16Array(water.I)});}
const AN=[];let cam,camNode,board;
function setT(t){S.t=t;
  for(const n of AN){const e=n.__e,b=n.__base,k=e.k||0;
    switch(e.anim){
      case 'beacon':{const on=((t*4)%16)>=k||t>4;const pulse=0.85+0.25*Math.sin(t*5+k*0.4);n.setScale(e.s*pulse*(on?1.15:0.8),e.s*pulse*(on?1.15:0.8),e.s*pulse*(on?1.15:0.8));break;}
      case 'beacon_line':{const p=1+0.06*Math.sin(t*4);n.setScale(p,1,p);break;}
      case 'anemone':{const p=1+0.18*Math.sin(t*2.2-k*1.1);n.setScale(e.s*p,e.s*(1+0.3*Math.sin(t*2.2-k*1.1)),e.s*p);break;}
      case 'foam':{const o=0.18*Math.sin(t*0.9);n.setPosition(b.x,b.y,b.z-o);break;}
      case 'foam2':{const o=0.25*Math.sin(t*0.9-0.8);n.setPosition(b.x,b.y,b.z-o);break;}
      case 'gull_fly':{const a=t*0.5+k*2;n.setPosition(b.x+Math.cos(a)*4,b.y+0.4*Math.sin(a*2),b.z+Math.sin(a)*3);n.setRotationFromEuler(0,-a*180/Math.PI,12*Math.sin(t*6+k));break;}
      case 'gull_perch':{n.setRotationFromEuler(0,e.rz*180/Math.PI+18*Math.sin(t*1.3),0);break;}
      case 'crab':{const x=Math.sin(t*1.1)*0.5;n.setPosition(b.x+x,b.y,b.z);break;}
      case 'hermit':{const s=0.75+0.25*Math.max(0,Math.sin(t*1.5));n.setScale(e.s*s,e.s*s,e.s*s);break;}
      case 'bottle':{n.setPosition(b.x+t*0.25,b.y+0.03*Math.sin(t*2),b.z);n.setRotationFromEuler(8*Math.sin(t*1.5),e.rz*57.3+t*6,6*Math.cos(t*1.2));break;}
      case 'cloud':{n.setPosition(b.x+t*0.35,b.y,b.z);break;}
      case 'lamp':{const p=1+0.12*Math.sin(t*3);n.setScale(p,1,p);break;}
      case 'bell':{n.setRotationFromEuler(4*Math.sin(t*2.2),e.rz*57.3,3*Math.sin(t*1.7));break;}
    }}
  // tide-in clear demo on cell (5,2): 1.5–3.5 s
  if(S.clearCell){const {sheet,piece,base}=S.clearCell;const u=(t-1.5)/2.0;
    if(u<0||u>1){sheet.active=false;piece.active=!NOP;piece.setScale(1,1,1);piece.setPosition(base);}
    else{sheet.active=true;const fill=u<0.35?u/0.35:u>0.75?(1-u)/0.25:1;sheet.setScale(0.3+0.7*Math.min(1,u/0.35),1,0.3+0.7*Math.min(1,u/0.35));sheet.setPosition(base.x,base.y+0.006+0.035*fill,base.z);
      const ps=u<0.4?1-u/0.4:u>0.6?Math.min(1,(u-0.6)/0.25):0;piece.active=!NOP&&ps>0.01;piece.setScale(ps,ps,ps);piece.setPosition(base.x,base.y+(u>0.6?0.5*(1-ps):0.08*u),base.z);}}
  if(water)waterAt(t,camNode.worldPosition);}
async function go(){
  const [M,LY]=await Promise.all([fetch('coast_meshes.json').then(r=>r.json()),fetch('coast_layout.json').then(r=>r.json())]);Object.assign(DATA,M);
  const sc=director.getScene();for(const c of sc.children.slice()){try{c.active=false;}catch(e){L('deact',c.name,e.message);}}
  try{director.pause&&0;}catch(e){}await new Promise((ok,no)=>cc.assetManager.loadBundle('shared_effects',(e,b)=>e?no(e):ok(b)));await new Promise(r=>setTimeout(r,300));const G=sc.globals;
  G.shadows.enabled=true;G.shadows.type=1;G.shadows.shadowMapSize=2048;
  G.ambient.skyIllum=34000;G.ambient.skyColor=new Color(160,205,255,255);G.ambient.groundAlbedo=new Color(240,220,170,255);
  board=new Node('coast');sc.addChild(board);
  for(const e of LY.layout){if(e.piece&&NOP)continue;const n=inst(board,e);if(n&&e.anim)AN.push(n);if(n&&e.cell&&e.cell[0]===5&&e.cell[1]===2)S.clearPiece=n;}
  if(q.get("nowater")!=="1")buildWater(board,LY.shore);
  if(S.clearPiece||NOP){const cellPos=S.clearPiece?S.clearPiece.position.clone():new Vec3(-1,0.1,2);const sh=inst(board,{mesh:'tide_sheet',p:[cellPos.x,cellPos.y,cellPos.z],rz:0,s:1});sh.active=false;
    S.clearCell={sheet:sh,piece:S.clearPiece||new Node('none'),base:cellPos};}
  {const P=[],C=[],I=[],NS=24,NR=10,RR=300;for(let r=0;r<=NR;r++){const el=(r/NR)*Math.PI/2*1.0-0.05;for(let i=0;i<=NS;i++){const a=i/NS*Math.PI*2;P.push(Math.cos(a)*Math.cos(el)*RR,Math.sin(el)*RR-20,Math.sin(a)*Math.cos(el)*RR);
      const u=Math.min(1,Math.max(0,r/NR));const lin=c=>Math.pow(c,2.2);const h=[0.86,0.95,1.0],zc=[0.28,0.62,0.95];const m=Math.pow(u,0.6);C.push(lin(h[0]*(1-m)+zc[0]*m),lin(h[1]*(1-m)+zc[1]*m),lin(h[2]*(1-m)+zc[2]*m),1);}}
    for(let r=0;r<NR;r++)for(let i=0;i<NS;i++){const a=r*(NS+1)+i,b=a+1,c=a+NS+1,d=c+1;I.push(a,b,c,b,d,c);}
    const N=P.map((v,i)=>-v/RR);const sn=new Node('sky');sc.addChild(sn);const sr=sn.addComponent(MeshRenderer);sr.mesh=utils.MeshUtils.createMesh({positions:P,normals:N,colors:C,indices:I});sr.setMaterial(mat('unlit',1),0);sr.shadowCastingMode=0;sr.receiveShadow=0;}
  camNode=new Node('cam');sc.addChild(camNode);cam=camNode.addComponent(Camera);cam.clearColor=new Color(92,190,248,255);cam.far=400;cam.near=0.1;cam.fov=Number(q.get('fov')||60);
  const shots={game:{tgt:[0,0,0.25],pitch:+(q.get('pitch')||42),dist:+(q.get('dist')||16.5),yaw:0},close_beacon:{tgt:[1,0.2,-1],pitch:42,dist:3.2,yaw:-18},close_edge:{tgt:[-2.5,0.2,4.0],pitch:22,dist:4.0,yaw:25},close_conch:{tgt:[0,0.25,0],pitch:30,dist:2.6,yaw:40},arrival:{tgt:[0,0.4,9.5],pitch:24,dist:6.5,yaw:-35}};
  const s=shots[CAM];const tg=new Vec3(...s.tgt),pr=s.pitch*Math.PI/180,yw=s.yaw*Math.PI/180;
  camNode.setPosition(tg.x+Math.sin(yw)*Math.cos(pr)*s.dist,tg.y+Math.sin(pr)*s.dist,tg.z+Math.cos(yw)*Math.cos(pr)*s.dist);camNode.lookAt(tg);
  if(CAM==='game'){const sy=+(q.get('shift')||-8.5);camNode.setPosition(camNode.position.x,camNode.position.y,camNode.position.z);camNode.lookAt(new Vec3(tg.x,tg.y,tg.z+sy));}
  const ln=new Node('sun');sc.addChild(ln);const sun=ln.addComponent(DirectionalLight);sun.illuminance=+(q.get('lux')||105000);sun.color=new Color(255,240,214,255);
  sun.shadowEnabled=true;sun.shadowPcf=2;sun.shadowFixedArea=true;sun.shadowNear=0.1;sun.shadowFar=80;sun.shadowOrthoSize=16;ln.setPosition(0,30,0);ln.setRotationFromEuler(-46,-58,0);
  setT(+(q.get('t')||0));S.setT=setT;await new Promise(r=>setTimeout(r,600));S.ready=true;L('ok');}
// the launch scene must load first (it initialises the custom render pipeline that builtin-standard needs)
const wait=()=>{const sc=cc.director.getScene();if(sc&&sc.name&&sc.name!=='coastshot'&&(performance.now()>7000))go().catch(e=>{L('ERR',e&&e.stack||e);S.ready=true;});else setTimeout(wait,300);};
setTimeout(wait,800);
if(0)setTimeout(()=>go().catch(e=>{L('ERR',e&&e.stack||e);S.ready=true;}),800);
})();
