import Controller from '../runtime/mainline-controller';
export interface NativeView { render(snapshot: any): void; animate(visual: any, snapshot: any, done: () => void): void; cancelAnimations?(): void; onError?(error: Error): void; }
export interface LocalStoragePort { getItem(key: string): string | null; setItem(key: string, value: string): unknown; }
declare const Port: { createPort(storage: LocalStoragePort): { platform: any; journey: any; journeySnapshot(): any; createController(): Controller; bind(controller: Controller, view: NativeView, lifecycle?: any): any }; createSynchronousStorage(storage: LocalStoragePort): any; bind(controller: Controller, view: NativeView, lifecycle?: any): any; present(snapshot: any, edge?: 'before' | 'after'): any; };
export default Port;
