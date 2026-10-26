/** full8 (Mac m1 23bae2d6: in the DevTools mini-game the launch query never reaches location.search, so ?camTrace=1 did nothing).
 *  One search string for every debug / capture flag (camTrace, sailVoyage, sailshot, sailT, w, h, k, seaReveal …), merged from:
 *   1. location.search (web preview);
 *   2. wx.getEnterOptionsSync().query, then wx.getLaunchOptionsSync().query (DevTools 编译模式 启动参数) — develop/trial only,
 *      never a release build (a share-link query must not switch debug on);
 *   3. globalThis.__qfQuery ('?a=1&b=2' or {a:'1'}) set by a harness before the game boots.
 *  Later sources win. No source → '' → every flag stays off (default). No 'cc', never throws. */
import {qaQuery,qaSkipAllowed} from '../world-r2/QaSkip';
export function debugSearch(host:any=globalThis):string{
 const out=new Map<string,string>();
 const add=(s:string)=>{for(const part of s.replace(/^\?/,'').split('&')){if(!part)continue;const i=part.indexOf('=');out.set(i<0?part:part.slice(0,i),i<0?'':part.slice(i+1));}};
 try{const s=host?.location?.search;if(typeof s==='string')add(s);}catch{}
 try{if(host?.wx&&qaSkipAllowed(host))add(qaQuery({wx:host.wx}));}catch{}
 try{const f=host?.__qfQuery;if(typeof f==='string')add(f);else if(f&&typeof f==='object')for(const k of Object.keys(f))out.set(k,String(f[k]));}catch{}
 if(!out.size)return '';const parts:string[]=[];out.forEach((v,k)=>{parts.push(v===''&&!k.includes('=')?k:k+'='+v);});return '?'+parts.join('&');
}
