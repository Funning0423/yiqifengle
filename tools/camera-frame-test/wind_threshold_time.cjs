// 风力 0.95 阈值（apron_lift 触发）的上穿/回落时刻：node tools/camera-frame-test/wind_threshold_time.cjs（cwd = 仓库根）
const TH=+(process.env.WIND_TH||0.95);const S=require(process.cwd()+'/tools/camera-frame-test/flow_sim.cjs');
(async()=>{const env=S.create(),r=await S.run(env),F=r.frames;const co=F.find(f=>f.state==='crossing-out');let a=null,b=null;
for(let i=1;i<F.length;i++){if(a===null&&F[i-1].wind<TH&&F[i].wind>=TH)a=F[i];if(a&&b===null&&F[i-1].wind>=TH&&F[i].wind<TH)b=F[i];}
console.log(JSON.stringify({crossingOutT:co.t,up95:a&&{t:a.t,since:+(a.t-co.t).toFixed(3),state:a.state},down95:b&&{t:b.t,since:+(b.t-co.t).toFixed(3)},above95S:a&&b?+(b.t-a.t).toFixed(3):null}));})();
