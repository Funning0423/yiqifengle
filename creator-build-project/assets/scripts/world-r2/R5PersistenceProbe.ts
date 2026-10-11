import { sys } from 'cc';
import { DEBUG } from 'cc/env';
import { readLegacyJourney,LEGACY_JOURNEY_KEYS } from './LegacyJourneyReader';
import API from '../regional-r05/runtime/index.js';
import Provider from '../regional-r05/runtime/board-session-provider.js';
import Host from '../regional-r05/runtime/campaign-host.js';
import {createPersistentR5Port,unavailableJourney,R5_KEYS} from './PersistentR5Port';
export const TEST_FIXTURE_KIND='synthetic-mainline-schema-v3-for-isolated-regional-tests-not-user-save';
function testNamespace(namespace:string){if(!DEBUG||!/^dot-r5-v12-test-[a-zA-Z0-9:_-]+:$/.test(namespace))throw Error('Debug isolated test namespace required');}
export function createIsolatedTestPort(namespace:string,journeyNamespace?:string){testNamespace(namespace);if(journeyNamespace){testNamespace(journeyNamespace);if(sys.localStorage.getItem(journeyNamespace+'fixture-kind')!==TEST_FIXTURE_KIND)throw Error('Explicit synthetic-fixture provenance required');}const storage=journeyNamespace?{getItem:(key:string)=>sys.localStorage.getItem(journeyNamespace+key)}:sys.localStorage;return createPersistentR5Port(readLegacyJourney(storage),namespace);}
/** Debug-only isolated fixture seam. Never changes formal/mainline keys or credits inventory. */
export function installR5PersistenceProbe(){if(!DEBUG)return;
 (globalThis as any).__r5PersistenceProbe={api:API,keys:R5_KEYS,journey:()=>readLegacyJourney(sys.localStorage),fixtureKind:TEST_FIXTURE_KIND,
  open:(namespace:string,journeyNamespace?:string)=>{const p=createIsolatedTestPort(namespace,journeyNamespace);return {p,controller:new (Provider as any)({platform:p.platform,journey:p.journey}),selection:(s:any)=>(Host as any).inspectSelection(p,s)};},
  read:(namespace:string)=>{testNamespace(namespace);return R5_KEYS.map(k=>[k,sys.localStorage.getItem(namespace+k)]);},
  seedJourneyFixture:(namespace:string,raw:string)=>{testNamespace(namespace);if(LEGACY_JOURNEY_KEYS.some(k=>sys.localStorage.getItem(namespace+k)!==null)||sys.localStorage.getItem(namespace+'fixture-kind')!==null)throw Error('Fixture target not empty');const r=JSON.parse(raw);if(r.version!==3||r.records.some((x:any)=>x.bestStars>1))throw Error('Only clearly synthetic zero/single-star schema fixture');const view=readLegacyJourney({getItem:key=>key===LEGACY_JOURNEY_KEYS[0]?raw:null});if(view.readOnly)throw Error('Invalid test schema');sys.localStorage.setItem(namespace+LEGACY_JOURNEY_KEYS[0],raw);sys.localStorage.setItem(namespace+'fixture-kind',TEST_FIXTURE_KIND);if(sys.localStorage.getItem(namespace+LEGACY_JOURNEY_KEYS[0])!==raw)throw Error('Fixture readback mismatch');return {kind:TEST_FIXTURE_KIND,source:'explicit-browser-test',namespace};},
  seedV1:(namespace:string,raw:string)=>{testNamespace(namespace);createPersistentR5Port(unavailableJourney(),namespace);if(R5_KEYS.some(k=>sys.localStorage.getItem(namespace+k)!==null))throw Error('Target not empty');const r=JSON.parse(raw);if(r.version!==1||r.packId!=='regional-r05')throw Error('Only explicit v1 test fixture');(API as any).restore(r.checkpoint);sys.localStorage.setItem(namespace+R5_KEYS[0],raw);if(sys.localStorage.getItem(namespace+R5_KEYS[0])!==raw)throw Error('Fixture readback mismatch');return true;}
 };
}
