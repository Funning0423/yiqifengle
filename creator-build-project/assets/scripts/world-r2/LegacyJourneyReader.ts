import Progression from './LegacyProgressionV3.js';
export const LEGACY_JOURNEY_KEYS=['forest-v33-journey','forest-v3-progress','forest-v3-completed'];
export const JOURNEY_SOURCE_SHA256='a58d6cee97cb2e4e062170e82ff0771464bdb8fe36779dd52e0f417d12a9465a';
/** Exact authorized v1/v2/v3 reader behind a port with NO save capability.
 * Constructor's _save(false) cannot write. Only a frozen read-only projection escapes.
 * Never return the mutable Progression instance or an inventory/reward interface. */
export function readLegacyJourney(storage:{getItem:(key:string)=>string|null}) {
 const values:any={},errors:any={},reads:any[]=[];
 for(const key of LEGACY_JOURNEY_KEYS){try{values[key]=storage.getItem(key);reads.push({key,present:values[key]!==null&&values[key]!==undefined&&values[key]!==''});}catch(error){errors[key]=error;reads.push({key,present:false,failed:true});}}
 const noWritePort=Object.freeze({load:(key:string)=>{if(!LEGACY_JOURNEY_KEYS.includes(key))throw Error('Unexpected mainline key');if(errors[key])throw errors[key];return values[key];}});
 const p=new (Progression as any)(noWritePort);
 let version:any=null;try{const raw=values[LEGACY_JOURNEY_KEYS[0]],d=typeof raw==='string'?JSON.parse(raw):raw;version=d&&typeof d==='object'?(d.version??1):null;}catch{}
 return Object.freeze({readOnly:p.readOnly,records:Object.freeze(p.records.map((r:any)=>Object.freeze({...r}))),available:reads.some(x=>x.present),source:'authorized-v3-source-no-write-port',sourceSha256:JOURNEY_SOURCE_SHA256,version,noWritePort:true,reads:Object.freeze(reads.map(Object.freeze)),warning:p.storageWarning});
}
