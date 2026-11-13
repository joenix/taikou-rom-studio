import {fail,span,u16,decodeText} from './codec.js';
import LABELS from './faction-expansion-v142.json' with {type:'json'};
import ROSTER from './faction-roster-proposals-v142.json' with {type:'json'};

import {FEX142,factionExpansionLayout} from './fex-layout.js';
export {FEX142} from './fex-layout.js';
const TITLE=0x120,NEW_GAME_HOOK=0x14eb42;
const relationNames=['盟友','親密','良好','通常','敵視','敵対','交戦'];
const u32=(b,p)=>(u16(b,p)*0x10000+u16(b,p+2))>>>0;

/** Resolve FEX payload from the v1.42 new-game bridge, then validate its layout. */
export function readFactionExpansion(bytes,directory=null){
 const title=new TextDecoder('ascii').decode(span(bytes,TITLE,48)).trim();
 const layout=factionExpansionLayout(directory?.manifest.resources.faction_expansion);
 let payloadOffset;
 if(directory){
  const resource=directory.manifest.resources.faction_expansion;
  if(!resource)return null;
  payloadOffset=resource.offset;
  span(bytes,payloadOffset,layout.payloadSize);
 }else{
  if(title!==FEX142.title)return null;
  if(new TextDecoder('ascii').decode(span(bytes,0x150,48)).trim()!==title)fail('INVALID_FEX142','v1.42 双平台标题不一致');
  if(bytes[NEW_GAME_HOOK]!==0x4e||bytes[NEW_GAME_HOOK+1]!==0xf9)fail('INVALID_FEX142','v1.42 初始化入口不匹配');
  const bridge=u32(bytes,NEW_GAME_HOOK+2);
  span(bytes,bridge,16);
  if(bytes[bridge]!==0x4e||bytes[bridge+1]!==0xb9||u32(bytes,bridge+2)!==0x14e800||
     bytes[bridge+6]!==0x48||bytes[bridge+7]!==0xe7||bytes[bridge+8]!==0xff||bytes[bridge+9]!==0xfe||
     bytes[bridge+10]!==0x4e||bytes[bridge+11]!==0xb9)fail('INVALID_FEX142','v1.42 扩展初始化桥接损坏');
  const initializer=u32(bytes,bridge+12);
  if(bytes[initializer]!==0x41||bytes[initializer+1]!==0xfa)fail('INVALID_FEX142','FEX 默认数据入口不匹配');
  const displacement=(bytes[initializer+2]<<8)|bytes[initializer+3];
  payloadOffset=initializer+2+(displacement&0x8000?displacement-0x10000:displacement);
  span(bytes,payloadOffset,layout.payloadSize);
 }
 const factions=Array.from({length:layout.factionCount},(_,index)=>{
  const offset=payloadOffset+layout.factionStart+index*layout.factionStride;
  const homeCastleId=bytes[offset+21];
  if(homeCastleId<123||homeCastleId>=123+layout.castleCount)fail('INVALID_FEX142','扩展势力的据点编号越界',{record:20+index,offset:offset+21});
  const labels=LABELS.factions[index];
  const rosterPlan=ROSTER.factions.find(row=>row.factionId===20+index);
  return {id:20+index,offset,leaderId:u16(bytes,payloadOffset+layout.leaderIds+index*2),homeCastleId,
   name:labels?.name||`扩展势力 #${20+index}`,leaderIdentityName:labels?.leaderIdentityName||'',leaderCandidate:labels?.leaderCandidate||'',seatName:labels?.seatName||'',seatCastleId:labels?.seatCastleId??homeCastleId,
   plannedMembers:rosterPlan?.appliesToCurrentDraft?rosterPlan.plannedMembers:[],
   oldRelations:Array.from({length:20},(_,target)=>bytes[offset+1+target]),
   opaque:Array.from(span(bytes,offset+22,12))};
 });
 for(const f of factions)if(f.leaderId>=713)fail('INVALID_FEX142','首领身份编号越界',{record:f.id,offset:payloadOffset+layout.leaderIds+(f.id-20)*2});
 const castles=Array.from({length:layout.castleCount},(_,index)=>{
  const offset=payloadOffset+layout.castleStart+index*layout.castleStride;
  const id=bytes[offset],ownerFactionId=bytes[offset+2],governorId=u16(bytes,payloadOffset+layout.governorIds+index*2);
  if(id!==123+index||ownerFactionId>=38&&ownerFactionId!==0xff)fail('INVALID_FEX142','扩展城池编号或所属势力异常',{record:123+index,offset});
  if(governorId!==0xffff&&governorId>=713)fail('INVALID_FEX142','城主身份编号越界',{record:id,offset:payloadOffset+layout.governorIds+index*2});
  const labels=LABELS.castles[index],definitions=directory?.manifest.resources.castle_visit_definitions;
  let name=labels?.name;
  if(!name&&definitions?.schema==='castle.visit-definitions.v1'&&definitions.stride===20&&id<definitions.count){span(bytes,definitions.offset,definitions.count*20);name=decodeText(bytes,definitions.offset+id*20,9);if(name&&!name.endsWith('城'))name+='城';}
  return {id,offset,ownerFactionId,governorId,name:name||`扩展城池 #${id}`};
 });
 return {version:layout.version,payloadOffset,payloadSize:layout.payloadSize,layout,factions,castles,
  relation(source,target){
   if(source<20&&target>=20)return bytes[payloadOffset+layout.oldToNewRelations+source*18+(target-20)];
   if(source>=20&&target<20)return factions[source-20].oldRelations[target];
   if(source>=20&&target>=20)return bytes[payloadOffset+layout.newToNewRelations+(source-20)*18+(target-20)];
   return null;
  }};
}
export function relationView(target,raw){
 if(raw===null||raw===undefined)return {target,raw:0,code:3,label:'通常',treatyCode:0,treaty:'－',marriageBit:false};
 const code=raw&7;
 return {target,raw,code,label:relationNames[code]||'未核实关系',treatyCode:(raw>>>4)&3,
  treaty:['－','盟','属','未核实'][(raw>>>4)&3],marriageBit:!!(raw&8)};
}
export function writeFactionExpansion(bytes,expansion,factionId,{leaderId,homeCastleId}){
 const f=expansion?.factions.find(row=>row.id===factionId);
 if(!f)fail('READ_ONLY_RESOURCE','当前 ROM 不含可编辑的 FEX 势力记录');
 const changes=[];
 if(leaderId!==undefined){if(!Number.isInteger(leaderId)||leaderId<0||leaderId>=713)fail('INVALID_FIELD','首领身份须为 0–712 的武将 ID');if(expansion.factions.some(row=>row.id!==factionId&&row.leaderId===leaderId))fail('DUPLICATE_FACTION_LEADER','此人物已被另一扩展势力指定为首领候补');const p=expansion.payloadOffset+(expansion.layout??FEX142).leaderIds+(factionId-20)*2;changes.push([p,leaderId>>>8],[p+1,leaderId&255]);}
 if(homeCastleId!==undefined){if(!Number.isInteger(homeCastleId)||!expansion.castles.some(c=>c.id===homeCastleId&&c.ownerFactionId===factionId))fail('INVALID_FIELD','本城须从当前势力所属的扩展城池中选择');changes.push([f.offset+21,homeCastleId]);}
 const candidate=new Uint8Array(bytes);for(const [p,v] of changes)candidate[p]=v;
 return [...new Set(changes.map(([p])=>p))].map(offset=>({offset,before:bytes[offset],after:candidate[offset]})).filter(p=>p.before!==p.after);
}
