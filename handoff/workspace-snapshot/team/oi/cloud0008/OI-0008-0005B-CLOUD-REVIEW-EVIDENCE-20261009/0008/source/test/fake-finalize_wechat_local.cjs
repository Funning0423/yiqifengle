'use strict';
// STAND-IN for Oi's tools/finalize_wechat_local.cjs (real source not available to GGbot). Emulates only the documented behaviour:
// "removes only completely empty generated compile conditions, rejects nonempty ones". Usage: node fake-finalize_wechat_local.cjs <outDir> [--gate]
const fs = require('fs'), path = require('path');
const {isEmptyCondition} = require('../tools/wechat_first_open_condition.cjs');
const dir = process.argv.slice(2).find((a) => !a.startsWith('-'));
const f = path.join(dir, 'project.config.json');
const o = JSON.parse(fs.readFileSync(f, 'utf8'));
if (process.argv.includes('--first-open-condition=B')) { console.error('flag leaked into finalizer argv'); process.exit(9); }
if (o.condition !== undefined) {
  if (!isEmptyCondition(o.condition)) { console.error('REJECT: nonempty compile condition'); process.exit(5); }
  delete o.condition; fs.writeFileSync(f, JSON.stringify(o, null, 2) + '\n'); console.log('removed empty condition');
} else console.log('no condition');
