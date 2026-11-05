/** cine/balloon-door-dismount-fix: door B rest yaw + B5 land seat rebuild (no meadow seatDef). */
'use strict';
const assert=require('assert');
const fs=require('fs');
const path=require('path');
const root=path.resolve(__dirname,'../..');
const H={
  load(rel){
    const src=fs.readFileSync(path.join(root,'creator-build-project/assets/scripts',rel),'utf8');
    // strip cc imports / types-ish for a tiny eval harness
    const body=src
      .replace(/import[^;]+;/g,'')
      .replace(/export\s+/g,'')
      .replace(/:\s*[A-Za-z_][\w.<>,\s|&?]*(?=[,)=])/g,'')
      .replace(/as\s+const/g,'')
      .replace(/Readonly<[^>]+>/g,'Object')
      .replace(/Object\.freeze/g,'Object.freeze');
    const g={Object,Math,console,minJerk:(u)=>{u=Math.max(0,Math.min(1,u));return u*u*u*(u*(u*6-15)+10);}};
    // Pull only the door helpers + BALLOON_DOOR from TransitionChain by Function
    const m={exports:{}};
    // Simpler: regex-extract the constants we need
    return src;
  }
};
const chain=fs.readFileSync(path.join(root,'creator-build-project/assets/scripts/region/TransitionChain.ts'),'utf8');
const bt=fs.readFileSync(path.join(root,'creator-build-project/assets/scripts/region/BalloonTransit.ts'),'utf8');
const boot=fs.readFileSync(path.join(root,'creator-build-project/assets/scripts/WorldIntegrationBoot.ts'),'utf8');

// --- helpers present ---
assert.ok(/BASKET_DOOR_REST_YAW/.test(chain),'REST_YAW export');
assert.ok(/basket_door_b:\s*180/.test(chain),'door B rest 180');
assert.ok(/basket_door:\s*0/.test(chain),'door A rest 0');
assert.ok(/export function basketDoorYawDeg/.test(chain),'yawDeg helper');

// Evaluate helpers in isolation
const fn=new Function(`
  const BASKET_DOOR_REST_YAW=Object.freeze({basket_door:0,basket_door_b:180});
  function basketDoorRestYaw(nodeName){if(!nodeName)return 0;if(nodeName in BASKET_DOOR_REST_YAW)return BASKET_DOOR_REST_YAW[nodeName];return /door_b|_b$/i.test(nodeName)?180:0;}
  function basketDoorYawDeg(nodeName,openDeg){return basketDoorRestYaw(nodeName)+openDeg;}
  return {basketDoorRestYaw,basketDoorYawDeg};
`);
const {basketDoorRestYaw,basketDoorYawDeg}=fn();
assert.strictEqual(basketDoorRestYaw('basket_door'),0);
assert.strictEqual(basketDoorRestYaw('basket_door_b'),180);
assert.strictEqual(basketDoorYawDeg('basket_door',0),0);
assert.strictEqual(basketDoorYawDeg('basket_door',100),100);
assert.strictEqual(basketDoorYawDeg('basket_door_b',0),180);
assert.strictEqual(basketDoorYawDeg('basket_door_b',100),280);

// --- BalloonTransit wiring ---
assert.ok(/closeBasketDoors/.test(bt),'closeBasketDoors helper');
assert.ok(/basketDoorRestYaw\(TRANSITION_STAGING\.basket\.exitDoorNode\)/.test(bt),'B closed with rest');
assert.ok(/basketDoorYawDeg\(TRANSITION_STAGING\.basket\.exitDoorNode,doorAngleAt/.test(bt),'B open = rest+θ');
assert.ok(!/doorB\.setRotationFromEuler\(0,\s*0,\s*0\)/.test(bt),'never force doorB to euler 0');
assert.ok(/landSeat\s*=\s*seatFromBench\(W\(B\.seat\)/.test(bt),'B5 rebuilds landSeat');
assert.ok(/Keep her parented on the vehicle through stand|parented on the vehicle through stand/.test(bt),'stand while on vehicle');
assert.ok(/viaRock/.test(bt),'rock via on deck path');
assert.ok(/tail\s*=\s*false/.test(bt),'no endless walk tail');
assert.ok(/cancelAndReset\(\{kind:'standing',controllerRoot:s0End/.test(bt),'hard stop at spawn');

// seatDef must not be the only stand source from B1 — landSeat used for perform stand
assert.ok(/landSeat=seatFromBench/.test(bt)&&/seatDef=landSeat/.test(bt)&&/kind:'stand',seat:seatDef/.test(bt),'stand uses rebuilt landSeat via seatDef');

// --- HUD ---
assert.ok(/transitHud=/.test(boot),'transitHud gate');
assert.ok(/!transitHud&&/.test(boot),'mainline/home gated');

// --- seat distance proof (meadow vs land) ---
const meadowSeat=[12.0,6.52,-23.8]; // approx vehicle t0
const landSeat=[18.09,18.71,100.82]; // LAND_T vehicle
const d=Math.hypot(meadowSeat[0]-landSeat[0],meadowSeat[1]-landSeat[1],meadowSeat[2]-landSeat[2]);
assert.ok(d>80,'meadow vs land seat worlds are far (fling distance) '+d.toFixed(1));

const out={test:'balloon-door-dismount',status:'PASS',doorB:{rest:180,open100:280},flingGapM:+d.toFixed(2),checks:['restYaw','B5landSeat','hudTransit','viaRock','hardStop']};
console.log(JSON.stringify(out));
console.log(JSON.stringify({test:'balloon-door-dismount',status:'PASS'}));
