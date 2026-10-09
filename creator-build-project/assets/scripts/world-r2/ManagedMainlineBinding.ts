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
    // Original engine's two local 3x3 bomb charges, never journey inventory.
    useTool: (index: number) => submit(['bomb', index]),
    afterPaint: (_snapshot: any, _cells: any[]) => {},
    storageEntries: () => [],
  };
}
