const T=require('./topmap.cjs'),fs=require('fs'),text=require('./font.cjs');
function hsv(h,s,v){const f=(n)=>{const k=(n+h*6)%6;return v-v*s*Math.max(0,Math.min(k,4-k,1));};return [f(5)*255,f(3)*255,f(1)*255];}
function render(M,file,scale,marks,paths,title){const w=M.W*scale,h=M.H*scale,px=Buffer.alloc(w*h*3);let ylo=1e9,yhi=-1e9;for(const [k] of M.seen){const y=M.layers[(k/8)|0][k%8];ylo=Math.min(ylo,y);yhi=Math.max(yhi,y);}
 const reach=new Map();for(const [k] of M.seen){const ci=(k/8)|0;const y=M.layers[ci][k%8];if(!reach.has(ci)||y>reach.get(ci))reach.set(ci,y);}
 for(let gz=0;gz<M.H;gz++)for(let gx=0;gx<M.W;gx++){const ci=gz*M.W+gx;let col;if(reach.has(ci)){const t=(reach.get(ci)-ylo)/((yhi-ylo)||1);col=hsv(.62-.62*t,.55,.95);}else if(M.layers[ci].length){const y=Math.max(...M.layers[ci]);const g=90+Math.max(-40,Math.min(60,y*4));col=[g,g,g];}else col=[18,30,58];
  // flip z so +z (her forward from spawn) is down? draw north(-z) up: row = gz
  for(let a=0;a<scale;a++)for(let b=0;b<scale;b++){const o=((gz*scale+a)*w+gx*scale+b)*3;px[o]=col[0];px[o+1]=col[1];px[o+2]=col[2];}}
 const dot=(p,r,col)=>{const cx=(p[0]-M.x0)/M.c*scale,cz=(p[2]-M.z0)/M.c*scale;for(let y=-r;y<=r;y++)for(let x=-r;x<=r;x++){if(x*x+y*y>r*r)continue;const X=Math.round(cx+x),Y=Math.round(cz+y);if(X<0||Y<0||X>=w||Y>=h)continue;const o=(Y*w+X)*3;px[o]=col[0];px[o+1]=col[1];px[o+2]=col[2];}};
 for(const pa of paths)for(const p of pa.path)dot(p,Math.max(1,scale/2|0),pa.col||[255,255,255]);
 for(const m of marks){dot(m.p,m.r||scale*2+2,[20,20,20]);dot(m.p,(m.r||scale*2+2)-2,m.col);if(m.label){const cx=(m.p[0]-M.x0)/M.c*scale,cz=(m.p[2]-M.z0)/M.c*scale;text(px,w,h,m.label,Math.round(cx+(m.r||8)+2)+1,Math.round(cz-7)+1,3,[0,0,0]);text(px,w,h,m.label,Math.round(cx+(m.r||8)+2),Math.round(cz-7),3,[255,255,255]);}}
 // scale bar 10 m + north arrow text
 {const L=Math.round(10/M.c*scale);for(let x=10;x<10+L;x++)for(let y=h-14;y<h-10;y++){const o=(y*w+x)*3;px[o]=px[o+1]=px[o+2]=255;}text(px,w,h,'10m',12,h-34,3,[255,255,255]);text(px,w,h,'-z',w-40,8,3,[255,255,255]);}
 T.png(file,w,h,px);return {w,h,ylo,yhi};}
module.exports={render};
