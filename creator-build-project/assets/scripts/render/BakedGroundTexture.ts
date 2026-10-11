import {assetManager,Texture2D} from 'cc';
/**
 * E4 v1.3.1：关草时才加载的“烘焙草色地面贴图”（tex_meadow_ground_grassoff_1024.jpg）。
 * 场景 / 预制体里不再直接引用这张贴图（直接引用会跟场景一起加载，0.6 MiB 常驻显存），只存 bundle 名 + 路径：
 *  - 关草（WIND_QUALITY = OFF，或无实例化兜底超预算）→ setWanted(true)：开始加载；**加载完成前地面保持当前贴图**；
 *  - 加载成功 → addRef，记下地面当前贴图，再换成烘焙贴图；
 *  - 加载失败 → 地面保持原样，console.warn，记 failed（下次关草会重试）；
 *  - 恢复草 → setWanted(false)：换回原贴图，decRef（引用归零时由 assetManager 释放）；
 *  - 区域卸载（组件 onDestroy）→ dispose()：同上，之后的回调一律丢弃；
 *  - 快速开关：每次开 / 关都让代数 gen + 1，回调带着发起时的代数，代数不对 / 已不需要 / 已卸载 = 过期回调：
 *    不改地面，已经拿到的贴图 addRef 后立刻 decRef（不泄漏、不会把旧请求的贴图贴上去）。
 * 引擎相关的只有默认加载器（assetManager.getBundle / loadBundle / bundle.load），可以注入别的加载器测试。
 */
export type GroundTextureCallback=(err:Error|null,tex:Texture2D|null)=>void;
export type GroundTextureLoader=(bundle:string,path:string,done:GroundTextureCallback)=>void;
/** 地面材质上的贴图槽：读当前贴图、写贴图、目标是否还有效（MeadowInstancer 用地面 renderer 的材质实例实现）。 */
export interface GroundTextureTarget{get():any;set(tex:any):void;valid():boolean;}
/** 默认位置：region_meadow bundle 里 textures/tex_meadow_ground_grassoff_1024.jpg，导入为 texture 时子资源是 /texture。 */
export const BAKED_GROUND_DEFAULT_BUNDLE='region_meadow';
export const BAKED_GROUND_DEFAULT_PATH='textures/tex_meadow_ground_grassoff_1024/texture';

/** 默认加载器：bundle 已加载就直接用，否则先 loadBundle；没有 assetManager（测试桩 / 非引擎环境）按失败处理。 */
export function defaultGroundTextureLoader(bundle:string,path:string,done:GroundTextureCallback){
  const am:any=assetManager;
  if(!am||typeof am.getBundle!=='function'){done(Error('assetManager unavailable'),null);return;}
  const go=(b:any)=>{try{b.load(path,Texture2D,(e:any,t:any)=>done(e?(e instanceof Error?e:Error(String(e))):null,e?null:(t||null)));}catch(e){done(e as Error,null);}};
  const b=am.getBundle(bundle);if(b){go(b);return;}
  try{am.loadBundle(bundle,(e:any,lb:any)=>{if(e||!lb)done(e instanceof Error?e:Error(String(e||'bundle missing')),null);else go(lb);});}catch(e){done(e as Error,null);}
}

export class BakedGroundSwap{
  state:'idle'|'loading'|'applied'|'failed'='idle';
  wanted=false;
  readonly stats={loads:0,applied:0,restored:0,failed:0,stale:0,addRef:0,decRef:0};
  private gen=0;
  private tex:any=null;
  private original:any=null;
  private disposed=false;
  /** label（v1.3.3）：只用于警告文字；SkyNightTexture 复用本类按需加载夜空图时传“夜空贴图”。默认值保持 v1.3.2 的文字。 */
  constructor(private target:GroundTextureTarget,private loader:GroundTextureLoader,public bundle:string,public path:string,public label='烘焙地面贴图'){}
  /** 现在贴着的烘焙贴图（没贴 = null）。 */
  get applied():any{return this.tex;}
  setWanted(on:boolean){
    if(this.disposed||on===this.wanted)return;
    this.wanted=on;
    if(on)this.begin();else this.restore();
  }
  /** 区域卸载：换回原贴图（地面还在的话）、释放、之后的回调全部作废。可重复调用。 */
  dispose(){if(this.disposed)return;this.wanted=false;this.restore();this.disposed=true;}
  private begin(){
    const g=++this.gen;this.state='loading';this.stats.loads++;
    let called=false;
    const cb:GroundTextureCallback=(err,tex)=>{if(called)return;called=true;this.onLoaded(g,err,tex);};
    try{this.loader(this.bundle,this.path,cb);}catch(e){cb(e as Error,null);}
  }
  private onLoaded(g:number,err:Error|null,tex:any){
    const current=g===this.gen&&this.wanted&&!this.disposed;
    if(err||!tex){
      if(!current){this.stats.stale++;return;}
      this.state='failed';this.stats.failed++;
      console.warn(`BakedGroundSwap: ${this.label}加载失败（${this.bundle}/${this.path}），保持原贴图`,err);
      return;
    }
    this.ref(tex);
    if(!current){this.stats.stale++;this.unref(tex);return;}
    // v1.3.4 (E4-132-01): valid/get/set may all throw; every failure after addRef must release the reference.
    let original:any=null;
    try{
      if(!this.target.valid()){this.stats.stale++;this.unref(tex);this.state='failed';return;}
      original=this.target.get();
      this.target.set(tex);
    }catch(e){console.warn(`BakedGroundSwap: 换${this.label}失败`,e);this.unref(tex);this.state='failed';this.stats.failed++;return;}
    this.original=original;this.tex=tex;this.state='applied';this.stats.applied++;
  }
  private restore(){
    this.gen++; // 进行中的请求作废
    const t=this.tex;
    if(t){
      this.tex=null;
      try{if(this.target.valid()){this.target.set(this.original);this.stats.restored++;}}catch(e){console.warn(`BakedGroundSwap: 换回原贴图失败（${this.label}）`,e);}
      this.unref(t);
    }
    this.original=null;this.state='idle';
  }
  private ref(t:any){if(t&&typeof t.addRef==='function'){t.addRef();this.stats.addRef++;}}
  private unref(t:any){if(t&&typeof t.decRef==='function'){t.decRef();this.stats.decRef++;}}
}
