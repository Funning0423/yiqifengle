const z=require('zlib'),fs=require('fs'),FIX=process.argv[2],F=JSON.parse(z.gunzipSync(fs.readFileSync(FIX)));
const SC=[1000,1000,1000,1000,100,100,1000,1000,1000,1000,null,null,1,1,1,1,1];
const enc=rows=>{const R=rows.map(r=>[r[0],...r[1],r[2],r[3],r[4],...r[5],r[6],r[7],r[8],r[9],r[10],r[11],r[12]]);return SC.map((sc,j)=>{const col=R.map(r=>r[j]);if(sc==null)return col;let p=0;return col.map(v=>{const q=Math.round(v*sc);if(q/sc!==v)throw Error('lossy '+v);const d=q-p;p=q;return d;});});};
const o={src:F.src,fmt:'col-delta: per case 17 columns (t, her xyz, fo.yaw, fo.pitch, fo.arm, cam xyz, yaw, pitch, writes, occFace, occChest, write, walking), scaled ints delta-coded, yaw/pitch raw'};
for(const k in F)if(k!=='src')o[k]=enc(F[k]);fs.writeFileSync(FIX,z.gzipSync(JSON.stringify(o),{level:9}));
