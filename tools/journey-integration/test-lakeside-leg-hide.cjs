// b17 night lakeside blocker guard (Mac diag 5095dfe2): the skycity→lakeside leg hides the island env_cloud_layer (not the sail
// sea_plane) once she boards (t >= R.cutT, under the black), day and night, restores them on release, and never touches the skycity.
const fs=require('fs'),path=require('path'),assert=require('assert');
const root=path.resolve(__dirname,'../..'),dir=path.join(root,'creator-build-project/assets/scripts/region');
const hide=fs.readFileSync(path.join(dir,'LakesideLegHide.ts'),'utf8'),adapter=fs.readFileSync(path.join(dir,'RegionJourneyAdapter.ts'),'utf8');
assert(fs.existsSync(path.join(dir,'LakesideLegHide.ts.meta')),'LakesideLegHide.ts.meta missing (build-guard)');
const list=/LAKESIDE_LEG_HIDE[^=]*=\s*(\[[^;]*\]);/.exec(hide);assert(list,'LAKESIDE_LEG_HIDE missing');
const pairs=JSON.parse(list[1].replace(/'/g,'"'));
const has=(s,n)=>pairs.some(p=>p[0]===s&&p[1]===n);
assert(has('room_no_original_chair','env_cloud_layer'),'island env_cloud_layer must be hidden on the lakeside leg');
assert(!pairs.some(p=>p[1]==='sea_plane'),'sea_plane belongs to cine 1c5adec5, not this hide');
for(const [s,n] of pairs)assert(!/sky|RegionJourney-skycity/.test(s+n),'skycity nodes must stay untouched: '+s+'/'+n);
assert(!/regionNightNow|night\s*\?/.test(hide.replace(/\/\*[\s\S]*?\*\//g,'')),'hide must not depend on day/night');
assert(/import \{LakesideLegHide\} from '\.\/LakesideLegHide'/.test(adapter),'adapter must import LakesideLegHide');
assert(/if\(t>=R\.cutT\)legHide\.apply\(director\.getScene\(\)\)/.test(adapter),'hide must run each ride frame after the boarding cut');
assert(/rig\.destroy\(\);legHide\.restore\(\);/.test(adapter),'release must restore the hidden nodes');
const sky=fs.readFileSync(path.join(dir,'SkycityCloudsea.ts'),'utf8');assert(!/LakesideLegHide/.test(sky),'skycity night look unchanged');
console.log('PASS lakeside-leg-hide: '+pairs.map(p=>p.join('/')).join(', '));
