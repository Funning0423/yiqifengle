(()=>{const R=window.__raf={t:[],epoch0:Date.now()-performance.now()};const f=ts=>{R.t.push(ts);if(R.t.length<200000)requestAnimationFrame(f)};requestAnimationFrame(f);})();
