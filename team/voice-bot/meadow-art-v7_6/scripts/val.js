const v=require('/tmp/gv/node_modules/gltf-validator');const fs=require('fs');
v.validateBytes(new Uint8Array(fs.readFileSync(process.argv[2])),{maxIssues:200}).then(r=>{const i=r.issues;console.log('err',i.numErrors,'warn',i.numWarnings,'info',i.numInfos);for(const m of i.messages.filter(m=>m.severity<=1).slice(0,40))console.log(m.severity,m.code,m.pointer,m.message)});
