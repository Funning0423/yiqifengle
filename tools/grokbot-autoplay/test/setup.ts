// Runs before the glue module evaluates: fake monotonic clock + launch query from env.
export const clock={ms:0};
Object.defineProperty(globalThis,'performance',{value:{now:()=>clock.ms},configurable:true,writable:true});
const q=process.env.GB_QUERY;if(q)(globalThis as any).location={search:q};
const logs:string[]=[];(globalThis as any).__testLogs=logs;
const orig=console.log;console.log=(...a:any[])=>{const s=a.join(' ');logs.push(s);if(process.env.GB_VERBOSE)orig(s);};
