import {fail,span} from './codec.js';
/** Data/table relocation contract, independent of the release name. */
export function worldLayoutContract(bytes,base,directory){
 const c=directory?.manifest.resources.world_map?.contract;if(!c)return {...base,operandPatches:[]};
 const bad=()=>fail('INVALID_WORLD_CONTRACT','扩展地图目录声明无效');
 if(c.schema!=='world.layout-contract.v1'||!c.towns||!Array.isArray(c.operand_patches)||c.operand_patches.length>1024)bad();
 const t=c.towns;
 for(const key of ['entries','bases','names','interiors','town_count','entry_count','block_count','scene_index','scene_index_rows'])if(!Number.isSafeInteger(t[key])||t[key]<0)bad();
 if(t.town_count<17||t.town_count>255||t.entry_count<t.town_count||t.entry_count>512||
    t.block_count!==204+(t.town_count-17)*12||t.scene_index_rows<30||t.scene_index_rows>128)bad();
 for(const [at,n] of [[t.entries,t.entry_count*8],[t.bases,t.town_count*2],[t.names,t.town_count*4],
   [t.interiors,t.block_count*64],[t.scene_index,t.scene_index_rows*41*2],[c.place_records,c.place_count*16]]){
  if(!Number.isSafeInteger(at)||!Number.isSafeInteger(n)||at<0x200||n<1||at+n>directory.payloadOffset)bad();span(bytes,at,n);}
 if(!Number.isSafeInteger(c.place_count)||c.place_count<base.placeCount||c.place_count>4096)bad();
 const occupied=new Set(),patches=[];
 for(const p of c.operand_patches){
  if(!Number.isSafeInteger(p.offset)||p.offset<0x200||typeof p.before!=='string'||typeof p.after!=='string'||
    !/^(?:[0-9a-f]{2}){1,4}$/.test(p.before)||p.before.length!==p.after.length||!/^[0-9a-f]+$/.test(p.after))bad();
  const after=Uint8Array.from(p.after.match(/../g),v=>parseInt(v,16));span(bytes,p.offset,after.length);
  for(let i=0;i<after.length;i++){if(occupied.has(p.offset+i)||bytes[p.offset+i]!==after[i])bad();occupied.add(p.offset+i);}
  patches.push({...p,afterBytes:after});
 }
 return {...base,towns:t,placeRecords:c.place_records,placeCount:c.place_count,
  nativeTownIds:Array.from({length:t.town_count-17},(_,i)=>i+17),operandPatches:patches};
}
