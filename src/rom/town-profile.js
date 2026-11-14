import {readRomDirectory} from './rom-directory.js';
import {span,integer,fail} from './codec.js';
const u16=(b,p)=>b[p]*256+b[p+1],u32=(b,p)=>u16(b,p)*65536+u16(b,p+2);
const ORIGINAL={9:3,10:3,11:2,12:2},TABLES={1:0xcf61c,2:0xcf6f0,3:0xcf7c4};
export function townSceneProfile(bytes,id){
 const d=readRomDirectory(bytes),r=d?.manifest.resources.town_scene_profiles;
 if(r&&r.schema!=='town.scene-profiles.v1')fail('INVALID_TOWN_PROFILE','町原画配置格式不受支持');
 const profile=r?.town_profiles?.[id]??ORIGINAL[id]??1;
 integer(profile,1,3,'町原画类型');const artTable=r?.profiles?.[profile]?.art_table??TABLES[profile];integer(artTable,0x200,(d?.payloadOffset??bytes.length)-212,'町原画表');span(bytes,artTable,212);
 const buildings=r?.town_buildings?.[id]??[];if(!Array.isArray(buildings)||buildings.length>64)fail('INVALID_TOWN_PROFILE','町建筑配置异常');
 for(const b of buildings){if(!Array.isArray(b.origin)||!Array.isArray(b.door)||!Array.isArray(b.tiles)||b.tiles.length!==b.width*b.height)fail('INVALID_TOWN_PROFILE','町建筑图块配置异常');integer(b.width,1,32,'建筑宽');integer(b.height,1,24,'建筑高');for(const v of b.tiles)integer(v,0,105,'建筑图块');if(b.binding){integer(b.binding.offset,0x200,(d?.payloadOffset??bytes.length)-4,'建筑入口');span(bytes,b.binding.offset,4);const q=b.binding,world=d.manifest.resources.world_map?.contract?.towns;if(q.kind==='facility'){integer(q.record,0,(world?.facility_count??90)-1,'设施记录');if(q.offset!==u32(bytes,0x2bcf2)+q.record*6+2||bytes[q.offset-2]!==q.service)fail('INVALID_TOWN_PROFILE','设施入口绑定与原生表不一致');}else if(q.kind==='resident'){const n=d.manifest.resources.town_residents;if(n?.schema!=='town.residents.v1'||n.stride!==24||!Number.isSafeInteger(n.count)||n.count>255)fail('INVALID_TOWN_PROFILE','町住民布局异常');integer(q.record,0,n.count-1,'住民记录');integer(q.service,0,5,'住民类型');span(bytes,n.offset,n.count*24);if(q.offset!==n.offset+q.record*24+20||bytes[n.offset+q.record*24+17]!==q.service)fail('INVALID_TOWN_PROFILE','住民入口绑定与原生表不一致');}else fail('INVALID_TOWN_PROFILE','未知的建筑入口类型');}}
 return {profile,artTable,buildings};
}
