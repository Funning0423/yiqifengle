import type {Cancellation} from '../world-r1/WorldFlowCore';
/** A real asset request deadline, never a substitute successful load. Late engine callbacks retain no scene lease. */
export function waitRegionAsset<T>(promise:Promise<T>,token:Cancellation,timeoutMs=20000):Promise<T>{
 let timer:ReturnType<typeof setTimeout>|undefined;
 const deadline=new Promise<never>((_resolve,reject)=>{timer=setTimeout(()=>reject(Error('region-asset-load-timeout')),timeoutMs);});
 return token.wait(Promise.race([promise,deadline])).finally(()=>{if(timer!==undefined)clearTimeout(timer);});
}
