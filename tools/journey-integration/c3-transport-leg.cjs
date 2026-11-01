'use strict';
// C3 rule for region/TransportLeg.ts (b1-yard-balloon, option a, Grok Bot approved): byte-identical to the base except
// exact pinned lines. Each pinned line may be the base line or exactly its pinned new content (exact strings, not patterns).
// Combined allowlist: SAIL_M1_LOCAL (GGbot walk merge 8a63be5b, final M1 93ac386e) + K0 (运镜bot palm clearance, a1c4c07d).
const assert=require('assert');
const PINS=[
 {key:'SAIL_M1_LOCAL',old:'export const SAIL_M1_LOCAL:Vec=[2.6,2.2,11.6];',new:'export const SAIL_M1_LOCAL:Vec=[2.2,2.803,6.8];/* b20 meadow-walk-fixes: = baked RegionNodes M1 on the path (was [2.6,2.2,11.6], then [2.6,2.764,6.8]) */'},
 {key:'K0',old:'const K0:SailOff={back:12,side:-4,up:4,fov:50,look:2,orb:0};',new:'const K0:SailOff={back:10.5,side:-4.2,up:4,fov:60,look:0.5,orb:0};'},
];
function checkTransportLeg(base,src,label='region/TransportLeg.ts',baseRef='base'){
 const bl=base.split('\n'),sl=src.split('\n');
 for(const p of PINS){const i=bl.indexOf(p.old);assert.ok(i>=0&&bl.indexOf(p.old,i+1)<0,'C3: base '+p.key+' line not found once in '+label);}
 assert.equal(sl.length,bl.length,'C3: '+label+' changed vs '+baseRef+' (line count '+sl.length+' != '+bl.length+'; only the pinned SAIL_M1_LOCAL / K0 lines may differ)');
 for(let i=0;i<bl.length;i++){if(sl[i]===bl[i])continue;const p=PINS.find(q=>q.old===bl[i]);
  assert.ok(p&&sl[i]===p.new,'C3: '+label+' changed vs '+baseRef+' at line '+(i+1)+' (only the pinned SAIL_M1_LOCAL / K0 lines may differ): '+JSON.stringify(sl[i]));}
}
module.exports={checkTransportLeg,PINS};
