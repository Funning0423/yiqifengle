const R='/tmp/wtE';const S=require(R+'/tools/journey-integration/journey-scene.cjs'),F=require(R+'/tools/journey-integration/journey-framing-lib.cjs');
const L=S.legs[1],T=S.routeLength(L.path),f=S.focus2,P=require('./a2.json'),last=P.at(-1),root=last.root;
const ring=[];for(const r of [0,2,4,6])for(let a=0;a<(r?8:1);a++)ring.push([f[0]+r*Math.cos(a*Math.PI/4),f[1]+.1,f[2]+r*Math.sin(a*Math.PI/4)]);
const vis=pos=>ring.filter(q=>!S.blockers(L.objs,pos,q).length).length/ring.length;
// horizontal axis: from plaza toward A2 cam
let ax=[last.position[0]-f[0],last.position[2]-f[2]];const l=Math.hypot(...ax);ax=ax.map(x=>x/l);const sd=[-ax[1],ax[0]];
console.error('f',f.map(x=>x.toFixed(1)),'A2 last cam',last.position.map(x=>x.toFixed(2)),'floor',f[1].toFixed(2),'dist',l.toFixed(1),'root',root.map(x=>x.toFixed(2)));
const out=[];
for(const back of [16,18,20,22])for(const up of [12,13,14,15])for(const side of [-2,0])for(const w of [.3,.4,.5]){
 const pos=[root[0]+ax[0]*back+sd[0]*side,f[1]+up,root[2]+ax[1]*back+sd[1]*side],ch=[root[0],root[1]+.9,root[2]],tgt=f.map((x,i)=>x+(ch[i]-x)*w);
 const c={position:pos,target:tgt,fovVerticalDeg:last.fov},b=F.body(c,root),pl=F.ndc(c,f),[cl]=S.clearance(pos,L.objs),hid=[.9,1.5,1.6].some(y=>S.blockers(L.objs,pos,[root[0],root[1]+y,root[2]]).length);
 globalThis.k??={n:0,f:0,h:0,c:0};k.n++;if(!b.inFrame)k.f++;if(hid)k.h++;if(cl<1)k.c++; if(!b.inFrame||hid||cl<1)continue;out.push({back,up,side,w,vis:+vis(pos).toFixed(2),h:+b.height.toFixed(3),px:+pl[0].toFixed(2),py:+pl[1].toFixed(2),cl:+cl.toFixed(1),move:+Math.hypot(...pos.map((x,i)=>x-last.position[i])).toFixed(1)});}
console.error(globalThis.k);console.log(out.sort((a,b)=>b.vis-a.vis||b.h-a.h).slice(0,30).map(o=>JSON.stringify(o)).join('\n'));
