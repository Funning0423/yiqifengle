const a=require(process.argv[2]||__dirname+'/audit.json'),k=process.argv[3]||'390x844',n=process.argv[4]||'new',st=+(process.argv[5]||1);
for(const r of a.screens[k][n].rows)if(Math.abs(r.t/st-Math.round(r.t/st))<1e-6)console.log(JSON.stringify(r));
