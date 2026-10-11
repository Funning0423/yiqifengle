import { _decorator, Component, Label, Color, UITransform } from 'cc';
import { RESULT_CHEST_RESOURCE, RESULT_CHEST_SIZE } from './ResultChestResource';
import type { ResultChestLease, ResultChestResource } from './ResultChestResource';
const { ccclass }=_decorator;

/** Read-only, result-page-owned art. No tap handler, reward command, world scene or camera changes. */
@ccclass('ResultChestView')
export class ResultChestView extends Component {
  resultKey='';
  private lease:ResultChestLease|null=null;
  private state:{resource:string,kind:string,open:number,error:string|null}|null=null;
  initialize(open:number,resource:ResultChestResource=RESULT_CHEST_RESOURCE){
    this.release();const priorLabel=this.node.getComponent(Label);if(priorLabel)priorLabel.enabled=false;const value=Number.isFinite(open)?Math.max(0,Math.min(1,open)):0;
    this.state={resource:resource.id,kind:resource.kind,open:value,error:null};
    try{this.lease=resource.create(this.node);this.lease.setOpen(value);if(this.lease.diagnostics?.().state==='loading')this.showStatus('宝箱载入中…');}
    catch(error){
      this.release();this.state.error=String(error);
      // Art failure must not abort paintResult before its return/save/replay controls are created.
      const label=this.node.getComponent(Label)||this.node.addComponent(Label);
      label.enabled=true;label.string='宝箱图像\n暂未载入';label.fontSize=12;label.lineHeight=18;label.color=new Color('#6a5432');
      label.overflow=Label.Overflow.SHRINK;label.enableWrapText=true;
      this.node.getComponent(UITransform)?.setContentSize(RESULT_CHEST_SIZE,RESULT_CHEST_SIZE);
      console.warn('Result chest art unavailable',this.state.error);
    }
  }
  setOpen(open:number){if(this.state?.error){this.initialize(open);return;}if(this.state)this.state.open=open;this.lease?.setOpen(open);}
  update(dt:number){this.lease?.tick?.(dt);const status=this.lease?.diagnostics?.();if(status?.state==='ready'){const label=this.node.getComponent(Label);if(label)label.enabled=false;}if(status?.error&&this.state&&!this.state.error){this.state.error=status.error;this.showStatus('宝箱图像\n暂未载入');console.warn('Result chest rendering failed',status.error);}}
  private showStatus(text:string){const label=this.node.getComponent(Label)||this.node.addComponent(Label);label.enabled=true;label.string=text;label.fontSize=12;label.lineHeight=18;label.color=new Color('#6a5432');label.overflow=Label.Overflow.SHRINK;label.enableWrapText=true;}
  diagnostics(){return this.state?{...this.state,renderer:this.lease?.diagnostics?.()??null}:null;}
  onEnable(){this.lease?.setVisible(true);}
  onDisable(){this.lease?.setVisible(false);}
  onDestroy(){this.release();}
  private release(){this.lease?.dispose();this.lease=null;}
}
