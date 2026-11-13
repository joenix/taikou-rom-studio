import {fail} from './codec.js';

/** Optional runtime assets are schema-driven, never identified by release names. */
export function verifyRuntimeResources(bytes,directory){
 const resources=directory?.manifest.resources||{},limit=directory?.payloadOffset??bytes.length,result={};
 const bad=id=>fail('INVALID_RUNTIME_RESOURCE',`ROM 的${id==='army_navigation'?'部队行船':'行船图像'}资源声明损坏`);
 const span=(r,id)=>{
  if(!Number.isSafeInteger(r.offset)||!Number.isSafeInteger(r.length)||r.offset<0x200||r.length<1||r.offset+r.length>limit)bad(id);
 };
 for(const [id,schema,width,height] of [['warship_sprites','world.warship-sprites.v1',32,32],['personal_boat_sprites','world.personal-boat-sprites.v2',16,24]]){
  const r=resources[id];if(!r)continue;span(r,id);
  if(r.schema!==schema){result[id]={schema:r.schema,mode:'preserved-unknown',offset:r.offset,length:r.length};continue;}
  if(r.width!==width||r.height!==height||r.count!==4||r.stride!==width*height/2*(id==='personal_boat_sprites'?2:1)||r.length!==r.count*r.stride||!Number.isInteger(r.palette)||r.palette<0||r.palette>3)bad(id);
  if(id==='warship_sprites'&&(!Number.isInteger(r.vram_first_tile)||!Number.isInteger(r.vram_tiles)||r.vram_first_tile<0||r.vram_tiles!==r.length/32||r.vram_first_tile+r.vram_tiles>2048))bad(id);
  result[id]={schema:r.schema,mode:'validated-readonly',offset:r.offset,length:r.length};
 }
 const r=resources.army_navigation;
 if(r){
  if(r.schema!=='world.army-navigation.v1')result.army_navigation={schema:r.schema,mode:'preserved-unknown'};
  else{
   const route=resources.road_flow,inside=n=>Number.isSafeInteger(n)&&n%2===0&&n>=route?.code_offset&&n<route.code_offset+route.code_bytes;
   if(!route||r.world_only!==true||r.standard_destinations!==route.goal_count||r.npc_remote_steps!==8||
      ['entry','fill_buffer_entry','visible_buffer_entry','remote_entry','sprite_entry','water_query'].some(k=>!inside(r[k]))||
      ['actor_water_query','cache_water_query','combat_entry','combat_target_entry','combat_notice'].some(k=>r[k]!==undefined&&!inside(r[k]))||
      !Number.isSafeInteger(r.ui_work_base)||!Number.isSafeInteger(r.ui_work_size)||r.ui_work_size<1||r.ui_work_base<0x200000||r.ui_work_base+r.ui_work_size>0x210000)bad('army_navigation');
   result.army_navigation={schema:r.schema,mode:'validated-readonly',combatRule:r.combat_rule??null};
  }
 }
 return result;
}
