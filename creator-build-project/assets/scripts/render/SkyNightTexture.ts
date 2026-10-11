import {_decorator,CCFloat,Component,director,MeshRenderer,gfx,Vec4} from 'cc';
import {BakedGroundSwap,defaultGroundTextureLoader,GroundTextureLoader} from './BakedGroundTexture';
const {ccclass,property}=_decorator;
/**
 * SkyNightTexture.ts · E4 v1.3.4（cursor，基于 grokbot2 / GGbot 的 v1.3.3 final）· Cocos Creator 3.8.8 · 未在 Creator / 真机里运行过（not_run）
 *
 * 草甸夜空图按设备选一张加载（Grok Bot 定）：
 *  - 支持 ASTC → 2048×1024 夜空（v0.1a PNG 源，预设 e4-meadow-sky-night = ASTC 4×4 thorough，约 2.0 MiB）；
 *  - 不支持 ASTC（含检测失败）→ 单独的 1024×512 夜空（由 v0.1a 线性光降采样 + 轻抖动 + 保星生成，**不压缩**，RGBA8 约 2.0 MiB）。
 *    不用 ETC2（实测出色带）。Creator 的兜底格式只能和原图同尺寸，所以 1024 是另一个资源。
 * 检测方法和引擎自己挑 .astc 的判法一模一样（cocos/asset/assets/image-asset.ts _deserialize）：
 *   device.getFormatFeatures(gfx.Format.ASTC_RGBA_4X4) & gfx.FormatFeatureBit.SAMPLED_TEXTURE。
 *   引擎用 deviceManager.gfxDevice（@internal）；这里用公开的 director.root.device，两者是同一个设备对象（GrassFallback 查实例化也用它）。
 *   拿不到设备 / 调用抛异常 = 'unknown'，**按不支持处理**并 console.warn 一次（引擎在没有设备时也会跳过 .astc）。
 * 前提：mat_meadow_sky 的 nightTexture **留空**（材质直接引用会跟材质一起加载 2048 那张，不支持 ASTC 的设备就会加载 2048 PNG 兜底 = 8 MiB）。
 * 加载 / 释放沿用 BakedGroundSwap（v1.3.1 的按需加载生命周期）：onLoad 开始加载，加载完成前 nightTexture 保持原值（留空 = 黑色）；
 *   成功 → addRef 后贴到天空材质实例；onDestroy（区域卸载）→ 换回原值、decRef（引用归零由 assetManager 释放）；过期回调不贴、不泄漏。
 * 加载前不黑（v1.3.3 final）：sky-unlit 默认路径的夜晚 = mix(两色渐变, 夜景图, nightTexMix)。onLoad 把 nightTexMix 设 0、
 *   nightZenith / nightHorizon 设成从美术 v0.1a 夜景图实测的颜色（NIGHT_GRADIENT_*），所以贴图到之前夜空是渐变，不是黑色。
 *   贴图到了（update 里看到 state 变成 applied）：
 *   - 当时夜空看得见（nightBlend > 0）→ nightTexMix 在 fadeSeconds（0.3 s）内线性 0 → 1，交叉淡入，没有硬切；
 *   - 当时是白天（nightBlend = 0，渐变也看不见）→ 直接设 1（之后进入夜晚时贴图已在，不再淡入）；
 *   - onLoad 里同步就加载好了（资源已在缓存）→ 直接设 1，第一帧就是夜景图。
 *   淡入中切昼夜：淡入照常走完，不重新开始（nightBlend 和 nightTexMix 互相独立）；白天输出和 v1.3.2 完全相同。
 *   淡入中卸载：dispose 换回原贴图并 decRef，nightTexMix 回 0（天空还在的话显示渐变，不黑），之后 update 什么都不做。
 *   加载失败：保持渐变（nightTexMix 0），retryDelaySeconds 后用 BakedGroundSwap 现有逻辑重试（setWanted(false) → setWanted(true)），最多 maxRetries 次。
 * 昼夜过渡请改天空 renderer 的材质实例（setNightBlend()，或 skyRenderer.getMaterialInstance(0).setProperty('nightBlend', …)）；
 *   本组件用了材质实例，改共享材质不会生效。
 */
export type AstcSupport='yes'|'no'|'unknown';
export interface AstcDetection{support:AstcSupport;via:string;}
export const SKY_NIGHT_BUNDLE='region_meadow';
export const SKY_NIGHT_ASTC_PATH='textures/tex_meadow_sky_night_2048x1024/texture';
export const SKY_NIGHT_NOASTC_PATH='textures/tex_meadow_sky_night_1024x512/texture';
/** 夜景图加载前的两色渐变，sRGB 0–255（保留小数），实测自美术 v0.1a 夜景 PNG（SHA256 1fd02ba7…acd0）：
 *  天顶 = 第 0 行 2048 个像素、地平线 = 第 878 行 2048 个像素，各自先转线性光求平均再转回 sRGB（tools/selftest/sky-night-1024.py gradient）。 */
export const NIGHT_GRADIENT_ZENITH:number[]=[16.0504,20.5051,48.0];
export const NIGHT_GRADIENT_HORIZON:number[]=[110.7436,133.7887,177.7198];
export const NIGHT_FADE_SECONDS=0.3;

/** 查 ASTC 4×4 是否可采样。device 参数只给测试用；不传就用 director.root.device。 */
export function detectAstcSupport(device?:any):AstcDetection{
  try{
    const dev:any=device!==undefined?device:(director as any)?.root?.device;
    if(!dev||typeof dev.getFormatFeatures!=='function')return {support:'unknown',via:'没有 gfx 设备或没有 getFormatFeatures'};
    const f=dev.getFormatFeatures(gfx.Format.ASTC_RGBA_4X4);
    if(typeof f!=='number')return {support:'unknown',via:'getFormatFeatures 返回值不是数字'};
    return (f&gfx.FormatFeatureBit.SAMPLED_TEXTURE)?{support:'yes',via:'getFormatFeatures(ASTC_RGBA_4X4) 含 SAMPLED_TEXTURE'}:{support:'no',via:'getFormatFeatures(ASTC_RGBA_4X4) 不含 SAMPLED_TEXTURE'};
  }catch(e){return {support:'unknown',via:'检测抛异常：'+String(e)};}
}
/** 选择：只有明确支持 ASTC 才用 2048；no / unknown 都用 1024。 */
export function selectNightSkyPath(support:AstcSupport,astcPath=SKY_NIGHT_ASTC_PATH,noAstcPath=SKY_NIGHT_NOASTC_PATH):{variant:'astc2048'|'raw1024';path:string}{
  return support==='yes'?{variant:'astc2048',path:astcPath}:{variant:'raw1024',path:noAstcPath};
}

@ccclass('SkyNightTexture')
export class SkyNightTexture extends Component{
  @property(MeshRenderer) skyRenderer:MeshRenderer|null=null;
  @property materialIndex=0;
  @property textureProperty='nightTexture';
  @property bundleName=SKY_NIGHT_BUNDLE;
  @property astcPath=SKY_NIGHT_ASTC_PATH;
  @property noAstcPath=SKY_NIGHT_NOASTC_PATH;
  /** 贴图到了以后从渐变淡到贴图的时间（秒）。0 = 直接切。 */
  @property fadeSeconds=NIGHT_FADE_SECONDS;
  /** onLoad 时把 nightZenith / nightHorizon 设成下面两色（关掉就用材质里的值）。 */
  @property setGradientColors=true;
  @property({type:[CCFloat]}) gradientZenith:number[]=NIGHT_GRADIENT_ZENITH.slice();
  @property({type:[CCFloat]}) gradientHorizon:number[]=NIGHT_GRADIENT_HORIZON.slice();
  /** 加载失败后多久重试、最多几次。 */
  @property retryDelaySeconds=2;
  @property maxRetries=3;
  /** 测试 / 特殊加载方式用；默认 = BakedGroundTexture 的 assetManager 加载器。 */
  loader:GroundTextureLoader|null=null;
  /** 测试用：注入设备；undefined = director.root.device。 */
  device:any=undefined;
  detection:AstcDetection|null=null;
  selected:{variant:'astc2048'|'raw1024';path:string}|null=null;
  private swap:BakedGroundSwap|null=null;
  /** 当前 nightTexMix（0 = 渐变，1 = 夜景图）。 */
  texMix=0;
  fading=false;
  /** 贴图到了以后怎么切的：'sync'（onLoad 里同步加载好）/ 'day'（白天到的，直接切）/ 'fade'（夜里到的，淡入）。 */
  switchMode:''|'sync'|'day'|'fade'='';
  retries=0;
  private retryTimer=0;
  private appliedSeen=false;
  get state(){const s=this.swap;return s?{state:s.state,applied:s.applied,stats:s.stats}:null;}
  private mi():any{const r:any=this.skyRenderer;return r&&r.isValid?r.getMaterialInstance(this.materialIndex):null;}
  private setMix(v:number){this.texMix=v;const m=this.mi();if(m)m.setProperty('nightTexMix',v);}
  /** 当前 nightBlend（材质实例上读；没设过 = 0）。 */
  get nightBlend():number{const m=this.mi();const v=m&&typeof m.getProperty==='function'?m.getProperty('nightBlend'):0;return typeof v==='number'?v:0;}
  /** 昼夜过渡：设到同一个材质实例上。 */
  setNightBlend(v:number){const m=this.mi();if(m)m.setProperty('nightBlend',v);}
  /** v1.3.4（E4-133-01）：加载前核对材质实例与贴图槽；不合格返回原因，组件不加载、保持渐变，不会报 applied。 */
  configError:string|null=null;
  validateMaterial():string|null{
    const m:any=this.mi();
    if(!m)return `skyRenderer 第 ${this.materialIndex} 个材质不存在`;
    if(typeof m.setProperty!=='function')return '材质实例没有 setProperty';
    if(typeof m.effectName==='string'&&m.effectName&&!/sky-unlit/.test(m.effectName))return `材质 effect 是 ${m.effectName}，不是 sky-unlit`;
    const passes:any[]|undefined=m.passes;
    if(Array.isArray(passes)){
      if(!passes.length)return '材质没有 pass（effect 无效）';
      // Pass.getHandle 对不存在的属性返回 0；以 nightBlend（sky-unlit 必有）为参照，参照有效时才逐项核对，
      // 这样能查出开了 SKY_NIGHT_TINT_ONLY（没有 nightTexture 采样器）的材质。
      const handle=(n:string)=>passes.reduce((h:number,p:any)=>h||(p&&typeof p.getHandle==='function'?(p.getHandle(n)|0):0),0);
      if(handle('nightBlend')){
        if(!handle(this.textureProperty))return `effect 里没有贴图槽 ${this.textureProperty}（开了 SKY_NIGHT_TINT_ONLY？）`;
        if(!handle('nightTexMix'))return 'effect 里没有 nightTexMix（不是 v1.3.3 起的 sky-unlit）';
      }
    }
    return null;
  }
  onLoad(){
    if(!this.skyRenderer){console.warn('SkyNightTexture: 没有指定 skyRenderer，不加载夜空图');return;}
    this.configError=this.validateMaterial();
    if(this.configError){console.warn(`SkyNightTexture: ${this.configError}，不加载夜空图，夜空保持渐变`);return;}
    this.detection=detectAstcSupport(this.device);
    if(this.detection.support==='unknown')console.warn(`SkyNightTexture: ASTC 支持检测失败（${this.detection.via}），按不支持处理，加载 1024×512 未压缩夜空`);
    this.selected=selectNightSkyPath(this.detection.support,this.astcPath,this.noAstcPath);
    const self=this;
    const mi=()=>self.mi();
    const m0=mi();
    if(m0&&this.setGradientColors){
      const c=(a:number[])=>new Vec4(a[0]/255,a[1]/255,a[2]/255,1);
      m0.setProperty('nightZenith',c(this.gradientZenith));m0.setProperty('nightHorizon',c(this.gradientHorizon));
    }
    this.setMix(0);
    const target={
      valid:()=>!!self.skyRenderer&&self.skyRenderer.isValid&&!!mi(),
      get:()=>{const m:any=mi();return m&&typeof m.getProperty==='function'?m.getProperty(self.textureProperty):null;},
      set:(tex:any)=>{const m:any=mi();if(!m)throw new Error('材质实例已不存在');m.setProperty(self.textureProperty,tex);},
    };
    this.swap=new BakedGroundSwap(target,this.loader||defaultGroundTextureLoader,this.bundleName,this.selected.path,'夜空贴图');
    this.swap.setWanted(true);
    if(this.swap.state==='applied'){this.appliedSeen=true;this.switchMode='sync';this.setMix(1);}   // 已在缓存、同步加载好：第一帧就是夜景图
  }
  update(dt:number){
    const s=this.swap;if(!s)return;
    if(s.state==='applied'){
      if(!this.appliedSeen){
        this.appliedSeen=true;
        if(this.nightBlend>0&&this.fadeSeconds>0){this.fading=true;this.switchMode='fade';}
        else{this.switchMode=this.nightBlend>0?'fade':'day';this.setMix(1);}
      }
      if(this.fading){
        const v=Math.min(1,this.texMix+Math.max(0,dt)/this.fadeSeconds);
        this.setMix(v);if(v>=1)this.fading=false;
      }
    }else if(s.state==='failed'){
      if(this.retries>=this.maxRetries)return;
      this.retryTimer+=Math.max(0,dt);
      if(this.retryTimer>=this.retryDelaySeconds){this.retryTimer=0;this.retries++;this.appliedSeen=false;s.setWanted(false);s.setWanted(true);}
    }
  }
  onDestroy(){
    if(this.swap){this.swap.dispose();this.swap=null;}
    this.fading=false;this.setMix(0);   // 天空还在的话回到渐变（不黑）
  }
}
