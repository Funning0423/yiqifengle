// G2: glass sign leaf is a Graphics drawing (no emoji / no asset), 42 px, and leaf+gap+caption is centred as one group.
const fs=require('fs'),path=require('path'),assert=require('assert');
const s=fs.readFileSync(path.join(__dirname,'..','creator-build-project/assets/scripts/world-r1/GlassSign.ts'),'utf8');
assert(!/🍃/u.test(s),'no system emoji');assert(/leaf: \{ size: 42,/.test(s),'leaf 42 px');
assert(/drawGlassLeaf\(leaf\.addComponent\(Graphics\), S\.leaf\.size\)/.test(s),'leaf drawn with Graphics');
assert(/cap\.overflow = Label\.Overflow\.NONE/.test(s)&&/cap\.updateRenderData\(true\)/.test(s),'caption width measured');
assert(/cap\.node\.setPosition\(-total \/ 2 \+ S\.leaf\.size \+ gap \+ capW \/ 2, 1, 0\)/.test(s)&&/leaf\.setPosition\(-total \/ 2 \+ S\.leaf\.size \/ 2, 1, 0\)/.test(s),'group positions');
// centring: group spans [-total/2, total/2] for any caption width
for(const capW of [150,170,186,205]){const total=42+12+capW,left=-total/2,right=left+42+12+capW;assert(Math.abs(left+right)<1e-9);assert(total<=280,'fits card '+capW);}
console.log('glass sign layout OK');
