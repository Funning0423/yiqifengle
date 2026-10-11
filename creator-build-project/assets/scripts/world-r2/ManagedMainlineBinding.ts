import { managedTools } from './ManagedTools';
/** Optional pure adapter for ManagedMobileBoardUI; it does not create or modify UI. */
export function createManagedMainlineBinding(port: any, controller: any, navigation: any) {
  let host: any = null;
  const command = (name: string, ...args: any[]) => host
    ? host.command(name, ...args) : { ok: false, reason: 'not-bound' };
  const submit = (action: any[]) => {
    const preview = command('previewAction', action);
    return preview.ok ? command('commitAction', preview.token) : preview;
  };
  return {
    controller,
    bind: (_controller: any, view: any) => {
      if (host) throw Error('A mainline board can only bind once');
      host = port.bind(controller, view);
      return host;
    },
    intercept: (name: string) => name === 'requestExit' ? navigation.exit()
      : name === 'resume' ? navigation.resume() : undefined,
    submit,
    tools: () => managedTools(controller.snapshot()),
    useTool: (kind: string, index: number) => {
      const s=controller.snapshot(), tool=managedTools(s).find(t=>t.kind===kind);
      if(s.state!=='run.ready'||s.readOnly)return {ok:false,reason:'input-disabled'};
      if(!tool||!tool.available)return {ok:false,reason:tool?.reason||'no-stage-tool'};
      return submit(kind==='bomb'?['bomb',index]:['tool',kind,index]);
    },
    hint: () => controller.hint(),
    restart: () => {
      const s = controller.snapshot();
      if (s.readOnly || !s.active || (s.state !== 'run.ready' && s.state !== 'run.paused')) return { ok: false, reason: 'not-playing' };
      if (s.active.status === 'won' && !s.result?.completionRecorded) return { ok: false, reason: 'unsaved-win' };
      const id = s.active.stageId;
      const discarded = command('discardActive');
      if (!discarded || discarded.ok === false) return discarded || { ok: false, reason: 'discard-failed' };
      return command('startStage', id, {});
    },
    afterPaint: (_snapshot: any, _cells: any[]) => {},
    storageEntries: () => [],
  };
}
