// @ts-nocheck
/** Original CommonR2 chest painter, extracted without changing its artwork or draw order.
 * Source fixed/shared/treasure.js SHA256 132077f104e8c5c965f00ee42278cdb4a6aa96cd7f14a93efb1cb4d6e62645a6.
 * Hand-painted 2D perspective, NOT a 3D mesh. No gameplay, inventory, DOM or timers.
 */
function path(c,pts){c.beginPath();pts.forEach((p,i)=>{if(p.length===2)c[i?'lineTo':'moveTo'](...p);else if(p.length===4)c.quadraticCurveTo(...p);else c.bezierCurveTo(...p);});c.closePath();}
function grad(c,a,b,stops){let g=c.createLinearGradient(a[0],a[1],b[0],b[1]);stops.forEach((s,i)=>g.addColorStop(i/(stops.length-1),s));return g;}
function paint(c,fill,stroke='#715634',width=1.5){c.fillStyle=fill;c.fill();if(stroke){c.strokeStyle=stroke;c.lineWidth=width;c.stroke();}}
function line(c,pts,color,width=1){c.beginPath();pts.forEach((p,i)=>p.length===2?c[i?'lineTo':'moveTo'](...p):p.length===4?c.quadraticCurveTo(...p):c.bezierCurveTo(...p));c.strokeStyle=color;c.lineWidth=width;c.stroke();}
function ellipse(c,x,y,rx,ry,color,stroke){c.beginPath();c.ellipse(x,y,rx,ry,0,0,Math.PI*2);paint(c,color,stroke||null,1);}
function grain(c,seed=3,n=170){c.save();c.clip();for(let i=0;i<n;i++){seed=(Math.imul(seed,1664525)+1013904223)>>>0;let x=(seed%12800)/100;seed=(Math.imul(seed,1664525)+1013904223)>>>0;let y=(seed%12800)/100;c.strokeStyle=i%3?'rgba(255,249,206,.12)':'rgba(57,62,39,.10)';c.lineWidth=.35+(i%3)*.25;c.beginPath();c.moveTo(x,y);c.lineTo(x+2+i%6,y-.3);c.stroke();}c.restore();}
function metal(c,x0=20,y0=20,x1=100,y1=100){return grad(c,[x0,y0],[x1,y1],['#fff0b4','#cfaa60','#8b713d','#e2bc71']);}
function leaf(c,x,y,s,rot,color){c.save();c.translate(x,y);c.rotate(rot);path(c,[[0,0],[-s,-s*.6,-s*.35,-s*1.6],[s*.5,-s*1.4,0,0]]);paint(c,color,'#8a854a',.65);line(c,[[0,0],[-s*.28,-s]],'#fff0b28c',.7);c.restore();}
function sparkle(c,x,y,r,alpha=1){c.save();c.globalAlpha*=alpha;path(c,[[x,y-r],[x+r*.23,y-r*.23],[x+r,y],[x+r*.23,y+r*.23],[x,y+r],[x-r*.23,y+r*.23],[x-r,y],[x-r*.23,y-r*.23]]);paint(c,'#fff9cd',null);c.restore();}
function body(c){
 ellipse(c,64,106,47,8,'#344c3933');path(c,[[20,58],[94,53],[109,63],[106,102],[90,111],[24,104]]);paint(c,grad(c,[29,57],[104,110],['#bf975c','#997044','#71593e']),'#65563a',2);grain(c,8,650);
 path(c,[[94,56],[109,63],[106,101],[92,108]]);paint(c,grad(c,[94,59],[110,99],['#ac884f','#705d3d']),'#6f5b39',1.2);for(let i=0;i<4;i++){line(c,[[26,69+i*9],[90,72+i*9]],'#634f3670',1);line(c,[[30,70+i*9],[86,73+i*9]],'#e4ba763f',.7);}
 for(let i=0;i<12;i++){let y=73+i*2.4;line(c,[[29+(i%3)*3,y],[48,y-2,80+(i%4)*3,y+1]],i%2?'#ead39830':'#5d49272b',.65);}ellipse(c,69,88,8,3,'#89663a60');line(c,[[62,88],[69,83,78,88],[68,91,62,88]],'#68523577',.8);
 for(let xx of[29,82]){path(c,[[xx,61],[xx+8,61],[xx+8,106],[xx,105]]);paint(c,metal(c,xx,59,xx+8,104),'#806a43',.8);for(let y of[71,97])ellipse(c,xx+4,y,1.7,1.8,'#ffdc96','#917346');}
 path(c,[[53,62],[67,62],[68,83],[59,88],[52,81]]);paint(c,metal(c,52,62,69,86),'#705e3d');ellipse(c,60,76,2.8,3,'#4c4532');path(c,[[59,77],[61,77],[62,82],[58,82]]);paint(c,'#4c4532',null);line(c,[[24,103],[91,109],[105,101]],'#dbba7d',1.5);
 leaf(c,22,105,10,-.9,'#71976a');leaf(c,25,105,8,.4,'#8ba978');
}
function lid(c){path(c,[[19,64],[19,46],[20,25,42,22],[88,18,99,34],[109,44],[109,63],[95,70]]);paint(c,grad(c,[34,22],[81,73],['#e1bf80','#b18a50','#85673e']),'#695537',1.8);grain(c,11,850);path(c,[[95,41],[99,34],[109,44],[109,63],[95,70]]);paint(c,grad(c,[97,35],[111,64],['#b5965c','#705937']),'#6d593a');
 for(let yy of[35,45,56]){line(c,[[23,yy],[54,yy-5,94,yy+2]],'#76563285',1);line(c,[[24,yy+1],[54,yy-4,92,yy+3]],'#f8df9a60',.6);}
 for(let xx of[29,82]){path(c,[[xx,65],[xx,39],[xx+1,29,xx+8,24],[xx+14,24],[xx+8,31,xx+8,43],[xx+8,67]]);paint(c,metal(c,xx,25,xx+9,65),'#8c7142',.8);for(let yy of[37,57])ellipse(c,xx+4,yy,1.5,1.7,'#ffe5a3','#896e43');}
 line(c,[[20,63],[95,69],[108,62]],'#f0d092',2.5);path(c,[[54,61],[66,62],[66,71],[54,70]]);paint(c,metal(c,54,59,67,73),'#866b40',.8);leaf(c,58,48,11,-.6,'#d6c781');leaf(c,62,50,10,.75,'#b8b474');line(c,[[60,50],[64,37]],'#777344',1);
}
export class OriginalResultChestPainter {
 constructor(platform){this.p=platform;this.cache={};this.builds=0;this.resolution=256;}
 sprite(id){if(this.cache[id])return this.cache[id];let a=this.p.createCanvas(this.resolution,this.resolution),c=a.getContext('2d');c.scale(this.resolution/128,this.resolution/128);if(id==='chestBody')body(c);else if(id==='chestLid')lid(c);else if(id==='halo'){let g=c.createRadialGradient(64,64,3,64,64,63);g.addColorStop(0,'#fff4aeaa');g.addColorStop(.45,'#f7e5a944');g.addColorStop(1,'#fff0ad00');c.fillStyle=g;c.fillRect(0,0,128,128);}this.cache[id]=a;this.builds++;return a;}
 drawChest(c,x,y,size=160,options={}){let open=Math.max(0,Math.min(1,options.open||0)),t=options.timeMs||0;c.save();c.translate(x-size/2,y-size/2);c.scale(size/128,size/128);if(options.glow||open){c.save();c.globalAlpha*=Math.max(open,.3)*(.75+.1*Math.sin(t/420));c.drawImage(this.sprite('halo'),-13,-22,156,156);c.restore();}
 if(open>.01){path(c,[[21,55],[93,53],[107,61],[93,77],[22,70]]);paint(c,'#544731','#b7955c',2);ellipse(c,63,61,32,9,'#ffdf87');}
 c.save();c.translate(0,-open*14);c.translate(0,63);c.scale(1,1+open*.15);c.translate(0,-63);c.drawImage(this.sprite('chestLid'),0,0,128,128);c.restore();if(open>.01){c.save();c.globalAlpha*=open;path(c,[[21,56],[94,52],[108,60],[92,71],[22,66]]);paint(c,'#594831','#bda06b',1.5);ellipse(c,63,60,32,6,'#ffe4a6');c.restore();}c.drawImage(this.sprite('chestBody'),0,0,128,128);
 // Closed lid overlaps the upper body; open lid stays behind the chest lip.
 if(open<.05){c.globalAlpha*=1-open/.05;c.drawImage(this.sprite('chestLid'),0,0,128,128);}if(open>.1){c.save();c.globalAlpha*=open;for(let i=0;i<5;i++){let phase=(t/1800+i*.19)%1;sparkle(c,37+i*14+Math.sin(t/700+i)*3,58-phase*40,1.4+Math.sin(phase*Math.PI)*1.7,Math.sin(phase*Math.PI));}c.restore();}c.restore();}
 dispose(){for(const canvas of Object.values(this.cache)){canvas.width=1;canvas.height=1;}this.cache={};}
}
