// r4.2 item 20 (Mac r4: navigation-guard FAILED waiting 30 s for the home 'leave' button; the r4 home intro needs ~35-36 s).
// The guard's navigation-target wait is now 60 s; every other wait keeps its value. Static check (the guard itself needs a browser).
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const g=fs.readFileSync(path.join(__dirname,'../test_world_navigation_guard.cjs'),'utf8');
const m=g.match(/const NAV_TARGET_TIMEOUT_MS=(\d+);const nav=async k=>\{await p\.waitForFunction\(k=>!!globalThis\.__worldIntegration\.layout\(\)\.targets\[k\],k,\{timeout:NAV_TARGET_TIMEOUT_MS\}\);/);
assert(m,'nav() waits with NAV_TARGET_TIMEOUT_MS');assert(Number(m[1])>=60000,'>= 60 s (intro ~36 s on the Mac)');
assert.match(g,/await nav\('leave'\)|nav\('leave'\)/,'leave goes through nav()');
assert.equal((g.match(/timeout:90000/g)||[]).length,2,'other waits unchanged');
console.log('PASS navigation-guard: home leave/target wait 60 s (was the 30 s default); other waits unchanged');
