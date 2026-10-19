'use strict';
/* 场景特效bot r5 S3 fix_r1 (asset tool, not shipped): seal the free-camera "under" rays of the lakeside with small rocks.
 * 运镜bot's free_cam_audit counts an upward frustum ray that lands on near-flat LK_terrain as 露底 ("under"). At the low orbit
 * (pitch -10/-5) the long, shallow rays graze the far west/north hills 27-90 m out; before d6d952e1 some of them were stopped
 * early by the taller trees/reeds. This tool adds one low LK_rock instance on the terrain at each cluster of those hit points,
 * so the ray ends on a rock instead of on the grass slope. Rocks never sit within KEEP_OFF m of the skycity walk/balloon route
 * (lakeside_skycity_mask.json route) and never on the lake.
 *   node lakeside_under_seal.cjs hits.jsonl [--dry]   hits.jsonl: one {under:[{d,hit,name}]} per cell (QA dump of the audit's rays)
 * Run it again on a fresh dump until the audit reports no under ray; existing LK_seal_rock_* are kept, new ones get the next index. */
var fs = require('fs'), path = require('path');
var TF = path.resolve(__dirname, '../../creator-build-project/assets/bundles/region_lakeside/scene_r5h_slim_transforms.json');
var MASK = path.join(__dirname, 'lakeside_skycity_mask.json');
var KEEP_OFF = 12, CLUSTER = 2.0, SCALE = 2.6, SINK = 0.15;
var args = process.argv.slice(2), dry = args.indexOf('--dry') >= 0, src = args.filter(function (a) { return a[0] !== '-'; })[0];
var T = JSON.parse(fs.readFileSync(TF, 'utf8')), route = JSON.parse(fs.readFileSync(MASK, 'utf8')).route;
var hits = [];
fs.readFileSync(src, 'utf8').split('\n').forEach(function (l) { if (!l.trim()) return; var x = JSON.parse(l); (x.under || []).forEach(function (u) { hits.push(u); }); });
function routeDist(x, z) { var b = 1e9; for (var i = 0; i < route.length; i++) b = Math.min(b, Math.hypot(route[i][0] - x, route[i][1] - z)); return b; }
var have = T.instances.filter(function (i) { return /^LK_seal_rock_\d+$/.test(i.name); });
var old = have.map(function (i) { return i.pos; }), placed = [], added = [], skipped = 0, next = have.length;
hits.sort(function (a, b) { return a.hit[0] - b.hit[0] || a.hit[2] - b.hit[2]; });
hits.forEach(function (u) {
  var h = u.hit;
  if (!/LK_terrain/.test(u.name)) { skipped++; return; }
  if (routeDist(h[0], h[2]) < KEEP_OFF) { skipped++; return; }
  // clusters within this pass; a ray that still reaches the grass next to an older rock gets its own rock (>= 0.6 m away)
  for (var i = 0; i < placed.length; i++) if (Math.hypot(placed[i][0] - h[0], placed[i][2] - h[2]) < CLUSTER) return;
  for (var k = 0; k < old.length; k++) if (Math.hypot(old[k][0] - h[0], old[k][2] - h[2]) < 0.6) { skipped++; return; }
  // long side across the ray, deterministic small tilt-free yaw
  var az = Math.atan2(u.d[0], u.d[2]), yaw = az + Math.PI / 2, q = [0, Math.sin(yaw / 2), 0, Math.cos(yaw / 2)];
  var p = [+h[0].toFixed(4), +(h[1] - SINK).toFixed(4), +h[2].toFixed(4)];
  var ins = { name: 'LK_seal_rock_' + (next++), glb: 'LK_rock.glb', group: 'bg', pos: p, rot_quat_xyzw: q.map(function (v) { return +v.toFixed(5); }), scale: [SCALE, SCALE * 0.9, SCALE], animated: false };
  placed.push(p); added.push(ins);
});
console.log(JSON.stringify({ hits: hits.length, skipped: skipped, existing: have.length, added: added.length, minRouteDist: added.length ? +Math.min.apply(null, added.map(function (i) { return routeDist(i.pos[0], i.pos[2]); })).toFixed(1) : null }));
if (!dry && added.length) {
  T.instances = T.instances.concat(added); T.instance_count = T.instances.length;
  fs.writeFileSync(TF, JSON.stringify(T));
}
