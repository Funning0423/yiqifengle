// Suite wrapper: runs the bash dry-run self-test of the production upload guard (FORMAL_RELEASE=1) (fake Creator).
const r=require('child_process').spawnSync('bash',[require('path').join(__dirname,'test_production_upload.sh')],{encoding:'utf8'});
process.stdout.write(r.stdout.split('\n').slice(-3).join('\n'));if(r.status!==0){process.stderr.write(r.stdout+r.stderr);process.exit(1);}
