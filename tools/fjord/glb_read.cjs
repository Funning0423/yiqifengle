'use strict';
// Read env_fjord.glb, including KHR_mesh_quantization node matrices.
const fs = require('node:fs');
function accessor(j, bin, index) {
  const a = j.accessors[index], v = j.bufferViews[a.bufferView];
  const start = (v.byteOffset || 0) + (a.byteOffset || 0);
  const n = a.type === 'VEC4' ? 4 : a.type === 'VEC3' ? 3 : a.type === 'VEC2' ? 2 : 1;
  const stride = a.componentType === 5126 ? 4 : a.componentType === 5123 || a.componentType === 5122 ? 2 : 1;
  const out = [];
  for (let i = 0; i < a.count; i++) {
    const p = [];
    for (let k = 0; k < n; k++) {
      const o = start + (i * n + k) * stride;
      let x;
      if (a.componentType === 5126) x = bin.readFloatLE(o);
      else if (a.componentType === 5123) x = bin.readUInt16LE(o);
      else if (a.componentType === 5122) x = bin.readInt16LE(o);
      else if (a.componentType === 5120) x = bin.readInt8(o);
      else x = bin.readUInt8(o);
      if (a.normalized) {
        if (a.componentType === 5123) x /= 65535;
        else if (a.componentType === 5120) x = Math.max(-1, x / 127);
        else if (a.componentType === 5121) x /= 255;
      }
      p.push(x);
    }
    out.push(n === 1 ? p[0] : p);
  }
  return out;
}
function applyMatrix(node, points) {
  const m = node.matrix;
  if (!m) return points;
  return points.map(p => [
    m[0] * p[0] + m[4] * p[1] + m[8] * p[2] + m[12],
    m[1] * p[0] + m[5] * p[1] + m[9] * p[2] + m[13],
    m[2] * p[0] + m[6] * p[1] + m[10] * p[2] + m[14],
  ]);
}
function loadGlb(file) {
  const b = fs.readFileSync(file), jl = b.readUInt32LE(12), j = JSON.parse(b.slice(20, 20 + jl).toString());
  const at = 20 + jl, bin = b.slice(at + 8, at + 8 + b.readUInt32LE(at));
  const meshes = [];
  for (const node of j.nodes) {
    if (node.mesh === undefined) continue;
    for (const prim of j.meshes[node.mesh].primitives) {
      const mat = j.materials[prim.material || 0] || {};
      meshes.push({
        name: node.name,
        pos: applyMatrix(node, accessor(j, bin, prim.attributes.POSITION)),
        col: prim.attributes.COLOR_0 !== undefined ? accessor(j, bin, prim.attributes.COLOR_0) : null,
        idx: accessor(j, bin, prim.indices),
        unlit: !!(mat.extensions && mat.extensions.KHR_materials_unlit),
      });
    }
  }
  return { json: j, bin, meshes, bytes: b.length };
}
module.exports = { loadGlb, accessor };
