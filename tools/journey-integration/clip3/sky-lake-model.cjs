'use strict';
// 运镜bot clip3: the GAME's skycity→lakeside ride (walk → board → lift-off → flight → touchdown) exactly as test_lake_leg_c models it
// (RegionJourneyAdapter atC wiring: SkyWalkShot + SkyLakeContinuous + basket close), for each of the 7 screens. The model is taken
// from test_lake_leg_c.cjs itself (its set-up up to the per-screen lens), so this gate can never drift from that test.
const fs=require('fs'),path=require('path'),os=require('os');
module.exports=async function skyLakeModel(){
 const T=path.join(__dirname,'../../transitions-continuous/test_lake_leg_c.cjs'),src=fs.readFileSync(T,'utf8');
 const a=src.indexOf('(async()=>{const G='),b=src.indexOf('  const from={position:add(S6,[-4,3,-4])');if(a<0||b<0)throw Error('test_lake_leg_c layout changed: update sky-lake-model.cjs');
 const body=src.slice(0,a).replace(/require\('\.\.\//g,"require('"+path.join(__dirname,'../../').replace(/\\/g,'/')+"")+
  'module.exports=async()=>{const __out=[];const G='+src.slice(a+'(async()=>{const G='.length,b)+'  __out.push({screen:[w,h],S,yawAt,herAt,R,M5,Wk});}\n return {G,legs:__out};};\n';
 const f=path.join(os.tmpdir(),'qf-clip3-sky-lake-model-'+process.pid+'.cjs');fs.writeFileSync(f,body);try{return await require(f)();}finally{try{fs.unlinkSync(f);}catch{}}};
