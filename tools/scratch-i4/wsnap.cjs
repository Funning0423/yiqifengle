const {createHarness}=require('../board-ui/harness.cjs');const H=createHarness();const D=H.load('region/RegionWalkableData.ts').REGION_WALKABLE_DATA;
const out={};for(const r of ['island','meadow','skycity']){const d=D[r];const bits=Buffer.from(d.bits,'base64'),dh=Buffer.from(d.dh,'base64');let p=0,prev=0;const h={};
 for(let ci=0;ci<d.W*d.H;ci++){if(!(bits[ci>>3]>>(ci&7)&1))continue;let z=0,sh=0,b;do{b=dh[p++];z|=(b&127)<<sh;sh+=7;}while(b&128);const dd=z&1?-(z+1)/2:z/2;prev+=dd;h[ci]=prev/100;}
 out[r]={W:d.W,H:d.H,c:d.c,x0:d.x0,z0:d.z0,h};}
require('fs').writeFileSync(process.argv[2],JSON.stringify(out));console.log(Object.keys(out).map(r=>r+':'+Object.keys(out[r].h).length).join(' '));
