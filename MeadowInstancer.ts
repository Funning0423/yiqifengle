import {_decorator,Component,JsonAsset,Node,MeshRenderer,Quat,Vec3,Vec4,renderer} from 'cc';
const {ccclass,property}=_decorator;
/**
 * 原型（未在 Cocos 中编译/运行，not_run）：Cocos 3.8 导入器不读 EXT_mesh_gpu_instancing，
 * 导入后每个 `meadow_*_instances.N` 节点只会显示 1 个模板。本组件按 extract_gpu_instances.py 导出的 JSON
 * 把每组展开成 N 个 MeshRenderer 节点，共享同一 mesh + 同一材质；材质开启 USE_INSTANCING 后，
 * 引擎按“mesh+材质”自动合成 1 次实例化 draw call（每组 1 次）。
 * 草的 `_ROOT_COLOR` 通过实例属性 a_root_color 传给风 shader（需要自定义 effect 声明该属性）。
 * 挂在草甸模型根节点上，instances 绑定 region_meadow bundle 里的 meadow_instances JSON。
 */
@ccclass('MeadowInstancer')
export class MeadowInstancer extends Component {
  @property(JsonAsset) instances:JsonAsset|null=null;
  /** 草和花都不投影（README 建议），省掉阴影 pass。 */
  @property castShadows=false;
  private spawned:Node[]=[];
  start(){
    const data:any=this.instances?.json;if(!data)throw Error('MeadowInstancer: bind instances JSON');
    const q=new Quat(),p=new Vec3(),s=new Vec3(),c=new Vec4();
    for(const grp of data.groups){
      const src=this.find(this.node,grp.node);if(!src){console.warn('MeadowInstancer: missing node',grp.node);continue;}
      const mr=src.getComponent(MeshRenderer);if(!mr||!mr.mesh)continue;
      const parent=src.parent!;const root=grp.attrs?._ROOT_COLOR;
      for(let i=0;i<grp.count;i++){
        const n=new Node(grp.template+'_'+i);n.layer=src.layer;parent.addChild(n);
        p.set(grp.t[i*3],grp.t[i*3+1],grp.t[i*3+2]);n.setPosition(p);
        if(grp.r){q.set(grp.r[i*4],grp.r[i*4+1],grp.r[i*4+2],grp.r[i*4+3]);n.setRotation(q);}
        if(grp.s){s.set(grp.s[i*3],grp.s[i*3+1],grp.s[i*3+2]);n.setScale(s);}
        const r=n.addComponent(MeshRenderer);r.mesh=mr.mesh;r.setSharedMaterial(mr.sharedMaterial!,0);
        r.shadowCastingMode=this.castShadows?renderer.scene.ShadowCastingMode.ON:renderer.scene.ShadowCastingMode.OFF;
        if(root){c.set(root[i*3],root[i*3+1],root[i*3+2],1);r.setInstancedAttribute('a_root_color',[c.x,c.y,c.z,c.w]);}
        this.spawned.push(n);
      }
      src.active=false; // 原始单个模板节点隐藏
    }
  }
  private find(n:Node,name:string):Node|null{if(n.name===name)return n;for(const c of n.children){const f=this.find(c,name);if(f)return f;}return null;}
  onDestroy(){for(const n of this.spawned)if(n.isValid)n.destroy();this.spawned=[];}
}
