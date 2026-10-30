'use strict';
/** Pure meta transform (no Editor API): returns a deep copy of the meta with ONLY userData.meshCompress.encode = true.
 *  Refuses (throws) unless meshCompress is exactly {enable:true, compress:true, encode:false|true, quantize:false},
 *  so Compress stays on and Quantize stays off without this code ever writing those fields. */
const EXPECTED_UUID = 'bb978abb-d907-5dba-be5a-14cc64f5e596';
function transformMeta(meta) {
  if (!meta || typeof meta !== 'object') throw new Error('meta missing');
  if (meta.uuid !== EXPECTED_UUID) throw new Error('unexpected uuid ' + meta.uuid);
  const mc = meta.userData && meta.userData.meshCompress;
  if (!mc || mc.enable !== true || mc.compress !== true || mc.quantize !== false || typeof mc.encode !== 'boolean')
    throw new Error('meshCompress not in the expected state: ' + JSON.stringify(mc));
  const out = JSON.parse(JSON.stringify(meta));
  out.userData.meshCompress.encode = true;
  return { meta: out, changed: mc.encode !== true };
}
module.exports = { transformMeta, EXPECTED_UUID };
