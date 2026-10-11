'use strict';
const assert=require('node:assert/strict'),crypto=require('node:crypto');
const approval=require('./audio_gesture_scope.json');
const digest=value=>crypto.createHash('sha256').update(value).digest('hex');
function beforeApprovedGesture(path,source){
 const entry=approval.sourceChanges[path];assert(entry,'only explicitly reviewed gesture source may normalize');
 assert.equal(digest(source),entry.afterSha256,path+' exact reviewed gesture source');
 const lines=source.split(/(?<=\n)/);
 for(const h of [...entry.reverseHunks].reverse()){
  assert.deepEqual(lines.slice(h.afterStart,h.afterStart+h.afterLines.length),h.afterLines,path+' exact approved gesture hunk');
  lines.splice(h.afterStart,h.afterLines.length,...h.beforeLines);
 }
 const result=lines.join('');assert.equal(digest(result),entry.beforeSha256,path+' exact frozen 3D predecessor');return result;
}
module.exports={approval,beforeApprovedGesture,digest};
