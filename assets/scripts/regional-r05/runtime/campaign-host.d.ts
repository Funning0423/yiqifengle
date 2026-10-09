interface StorageLike { getItem(key:string):string|null;setItem(key:string,value:string):void; }
interface Platform {load(key:string):unknown;save(key:string,value:unknown):unknown;}
interface JourneyView {readonly readOnly:boolean;readonly records:ReadonlyArray<{readonly bestStars:number;readonly [key:string]:unknown}>;readonly [key:string]:unknown;}
interface Persistence {platform:Platform;journey:JourneyView;inspect():Array<[string,unknown]>;}
export function createStorage(storage:StorageLike):Platform;
export function createPersistence(storage:StorageLike,journey:JourneyView):Persistence;
export function inspectSelection(persistence:Persistence,selection:{stageId:string;seed:number}):{ok:boolean;reason?:string;resume?:boolean;detail?:string};
export function resultPresentation(snapshot:any):{uiResultTitle?:string;uiResultCaption?:string;uiStatus?:string};
