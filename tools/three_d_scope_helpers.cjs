'use strict';
const assert=require('node:assert/strict'),crypto=require('node:crypto');
const approval=require('./integrated_3d_scope.json');
const {approval:gestureApproval,beforeApprovedGesture}=require('./audio_gesture_scope_helpers.cjs');
const digest=value=>crypto.createHash('sha256').update(value).digest('hex');
function beforeApproved3D(path,source){
 if(gestureApproval.sourceChanges[path])source=beforeApprovedGesture(path,source);
 const entry=approval.sourceChanges[path];assert(entry,'only explicitly reviewed source may normalize');
 assert.equal(digest(source),entry.afterSha256,path+' exact reviewed 3D source');
 const lines=source.split(/(?<=\n)/);
 for(const h of [...entry.reverseHunks].reverse()){
  assert.deepEqual(lines.slice(h.afterStart,h.afterStart+h.afterLines.length),h.afterLines,path+' exact 3D hunk');
  lines.splice(h.afterStart,h.afterLines.length,...h.beforeLines);
 }
 const result=lines.join('');assert.equal(digest(result),entry.beforeSha256,path+' byte-identical restored source');return result;
}
module.exports={approval,beforeApproved3D,digest};
