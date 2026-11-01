// Suite wrapper: runs the bash dry-run self-test of the E1 build guard (fake Creator).
const r=require('child_process').spawnSync('bash',[require('path').join(__dirname,'test_build_guard.sh')],{encoding:'utf8'});
process.stdout.write(r.stdout.split('\n').slice(-3).join('\n'));if(r.status!==0){process.stderr.write(r.stdout+r.stderr);process.exit(1);}
