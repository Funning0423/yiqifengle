'use strict';
/* Skycity floor seal I/O (QA + asset tool, not shipped).
 *   node skycity_seal_io.cjs dump   <env_skycity.glb> <out.json>   decoded world triangles (QA decoder space) + float root
 *   node skycity_seal_io.cjs append <env_skycity.glb> <mesh.json> <out.glb>
 *     appends ONE draco-compressed primitive (node env_sky_floor_seal, child of skycity_float_root, material M_sky_palette)
 *     every existing bufferView / accessor / node keeps its bytes and index; only new entries are added at the end.
 * draco3d is resolved from $DRACO3D (same as tools/camera-frame-test/glb_geometry.cjs). */
var fs = require('fs'), path = require('path');
var G = require('../camera-frame-test/glb_geometry.cjs');
function readGlb(f) {
  var b = fs.readFileSync(f), jl = b.readUInt32LE(12), j = JSON.parse(b.slice(20, 20 + jl).toString('utf8'));
  var bl = b.readUInt32LE(20 + jl), bin = b.slice(28 + jl, 28 + jl + bl);
  return { j: j, bin: bin };
}
function writeGlb(f, j, bin) {
  var js = Buffer.from(JSON.stringify(j), 'utf8'), jp = (4 - js.length % 4) % 4, bp = (4 - bin.length % 4) % 4;
  js = Buffer.concat([js, Buffer.alloc(jp, 0x20)]); bin = Buffer.concat([bin, Buffer.alloc(bp, 0)]);
  var h = Buffer.alloc(12); h.writeUInt32LE(0x46546C67, 0); h.writeUInt32LE(2, 4); h.writeUInt32LE(12 + 8 + js.length + 8 + bin.length, 8);
  var c0 = Buffer.alloc(8); c0.writeUInt32LE(js.length, 0); c0.writeUInt32LE(0x4E4F534A, 4);
  var c1 = Buffer.alloc(8); c1.writeUInt32LE(bin.length, 0); c1.writeUInt32LE(0x004E4942, 4);
  fs.writeFileSync(f, Buffer.concat([h, c0, js, c1, bin]));
}
function dracoModule() {
  var d = G.dracoDir(); if (!d) throw Error('draco3d not found ($DRACO3D)');
  return require(path.join(d, 'draco3d.js'));
}
function dump(src, out) {
  return G.decode(src).then(function (g) {
    var r = readGlb(src), root = null;
    r.j.nodes.forEach(function (n) { if (n.name === 'skycity_float_root') root = n.rotation || [0, 0, 0, 1]; });
    fs.writeFileSync(out, JSON.stringify({ floatRootRotation: root, meshes: g.meshes }));
    console.log('dumped', Object.keys(g.meshes).length, 'meshes');
  });
}
function append(src, meshFile, out) {
  var m = JSON.parse(fs.readFileSync(meshFile, 'utf8')), r = readGlb(src), j = r.j;
  if (j.nodes.some(function (n) { return n.name === 'env_sky_floor_seal'; })) throw Error('already sealed');
  var P = m.P, N = m.N, UV = m.UV, I = m.I, nv = P.length / 3, nf = I.length / 3;
  return dracoModule().createEncoderModule({}).then(function (E) {
    var mb = new E.MeshBuilder(), mesh = new E.Mesh(), enc = new E.Encoder();
    var ia = new Uint32Array(I);
    mb.AddFacesToMesh(mesh, nf, ia);
    var idP = mb.AddFloatAttributeToMesh(mesh, E.POSITION, nv, 3, new Float32Array(P));
    var idN = mb.AddFloatAttributeToMesh(mesh, E.NORMAL, nv, 3, new Float32Array(N));
    var idT = mb.AddFloatAttributeToMesh(mesh, E.TEX_COORD, nv, 2, new Float32Array(UV));
    var col = new Float32Array(nv * 3); for (var i = 0; i < col.length; i++) col[i] = 1;
    var idC = mb.AddFloatAttributeToMesh(mesh, E.COLOR, nv, 3, col);
    enc.SetAttributeQuantization(E.POSITION, 14); enc.SetAttributeQuantization(E.NORMAL, 10);
    enc.SetAttributeQuantization(E.TEX_COORD, 12); enc.SetAttributeQuantization(E.COLOR, 8);
    enc.SetEncodingMethod(E.MESH_EDGEBREAKER_ENCODING); enc.SetSpeedOptions(5, 5);
    var da = new E.DracoInt8Array(), len = enc.EncodeMeshToDracoBuffer(mesh, da);
    if (!len) throw Error('draco encode failed');
    var data = Buffer.alloc(len); for (var k = 0; k < len; k++) data[k] = da.GetValue(k);
    E.destroy(da); E.destroy(enc); E.destroy(mesh); E.destroy(mb);
    // the encoder numbers attributes in the order they were added
    var ids = { POSITION: idP, NORMAL: idN, TEXCOORD_0: idT, COLOR_0: idC };
    var pad = (4 - r.bin.length % 4) % 4, off = r.bin.length + pad;
    var bin = Buffer.concat([r.bin, Buffer.alloc(pad, 0), data]);
    var bvi = j.bufferViews.length; j.bufferViews.push({ buffer: 0, byteOffset: off, byteLength: len });
    j.buffers[0].byteLength = bin.length;
    function mm(a, c) { var lo = [], hi = []; for (var q = 0; q < c; q++) { lo.push(Infinity); hi.push(-Infinity); }
      for (var i2 = 0; i2 < a.length; i2++) { var q2 = i2 % c; lo[q2] = Math.min(lo[q2], a[i2]); hi[q2] = Math.max(hi[q2], a[i2]); } return [lo, hi]; }
    var pm = mm(P, 3), a0 = j.accessors.length;
    j.accessors.push({ componentType: 5126, count: nv, type: 'VEC3', min: pm[0], max: pm[1] });
    j.accessors.push({ componentType: 5126, count: nv, type: 'VEC3' });
    j.accessors.push({ componentType: 5126, count: nv, type: 'VEC2' });
    j.accessors.push({ componentType: 5126, count: nv, type: 'VEC3' });
    j.accessors.push({ componentType: nv > 65535 ? 5125 : 5123, count: I.length, type: 'SCALAR' });
    var mat = -1; j.materials.forEach(function (x, i3) { if (x.name === 'M_sky_palette') mat = i3; });
    if (mat < 0) throw Error('M_sky_palette missing');
    var mi = j.meshes.length;
    j.meshes.push({ name: 'env_sky_floor_seal', primitives: [{ attributes: { POSITION: a0, NORMAL: a0 + 1, TEXCOORD_0: a0 + 2, COLOR_0: a0 + 3 },
      indices: a0 + 4, material: mat, mode: 4, extensions: { KHR_draco_mesh_compression: { bufferView: bvi, attributes: ids } } }] });
    var ni = j.nodes.length; j.nodes.push({ name: 'env_sky_floor_seal', mesh: mi });
    var root = -1; j.nodes.forEach(function (n, i4) { if (n.name === 'skycity_float_root') root = i4; });
    j.nodes[root].children.push(ni);
    writeGlb(out, j, bin);
    console.log(JSON.stringify({ verts: nv, tris: nf, dracoBytes: len, out: out, bytes: fs.statSync(out).size }));
  });
}
var a = process.argv.slice(2);
(a[0] === 'dump' ? dump(a[1], a[2]) : a[0] === 'append' ? append(a[1], a[2], a[3]) : Promise.reject(Error('usage')))
  .catch(function (e) { console.error(e); process.exit(1); });
