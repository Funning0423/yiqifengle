'use strict';
// One physical chair specification shared by the mesh and seated pose contract.
const spec={width:.70,depth:.54,thickness:.055,backHeight:1.22,backLean:.075,yaw:-2.0,shiftX:-.16,turnArcX:-.3,turnArcZ:0};
function registration(r){return{...r,anchors:{...r.anchors,seat:r.anchors.seat.map((v,i)=>v+(i===0?spec.shiftX:0)),seatedFoot:r.anchors.seatedFoot.map((v,i)=>v+(i===0?spec.shiftX:0))},seatConfig:{...r.seatConfig,width:spec.width/r.girlScale,depth:spec.depth/r.girlScale,thickness:spec.thickness/r.girlScale}};}
module.exports={spec,registration};
