import {readRomDirectory} from './rom-directory.js';
import {PROFILE} from './profile.js';
import {fail,u16} from './codec.js';

/** Actual source identities copied into the new-faction runtime roster. */
export function residentBindings(bytes,directory=readRomDirectory(bytes)){
 const r=directory?.manifest.resources.resident_sources,bindings=new Map(),targets=new Set();
 if(r?.schema!=='resident.batch-bindings.v1')return bindings;
 if(r.source_resource!=='people'||r.stride!==16||!Number.isSafeInteger(r.offset)||r.offset<0x200||
    !Number.isInteger(r.count)||r.count<1||r.count>PROFILE.people.count||r.offset+r.count*16>directory.payloadOffset)
  fail('INVALID_RESIDENT_BINDINGS','新势力武将编制标记异常');
 for(let i=0;i<r.count;i++){
  const p=r.offset+i*16,source=u16(bytes,p)*65536+u16(bytes,p+2),id=(source-PROFILE.people.base)/PROFILE.people.stride;
  const target=u16(bytes,p+4)*65536+u16(bytes,p+6),layout=directory.manifest.resources.native_batch_layout;
  const oldSlot=(target-0xff04f0)/60,bankSlot=(target-layout?.actor_bank)/60;
  const validTarget=Number.isInteger(oldSlot)&&oldSlot>0&&oldSlot<241||layout?.schema==='native-faction-batch.v1'&&Number.isInteger(bankSlot)&&bankSlot>=0&&bankSlot<layout.actor_count;
  if(!Number.isInteger(id)||id<0||id>=PROFILE.people.count||u16(bytes,source)!==id||bindings.has(id)||bytes[p+12]<20||bytes[p+12]>37||bytes[p+13]<123||bytes[p+13]>158||bytes[p+14]>8||!validTarget||targets.has(target))
   fail('INVALID_RESIDENT_BINDINGS','新势力武将编制引用异常');
  targets.add(target);bindings.set(id,{id,sourceOffset:source,runtimeAddress:target,factionId:bytes[p+12],castleId:bytes[p+13],rank:bytes[p+14]});
 }
 return bindings;
}
export function newOfficerIds(bytes,directory=readRomDirectory(bytes)){return new Set(residentBindings(bytes,directory).keys());}
