import {readRomDirectory} from './rom-directory.js';
import {fail} from './codec.js';

const word=(b,p)=>(b[p]<<8)|b[p+1];
const long=(b,p)=>(word(b,p)*65536+word(b,p+2))>>>0;
/** Directory-described runtime fields; independent of release title/size. */
export function readRoadFlow(bytes,directory=readRomDirectory(bytes)){
 const r=directory?.manifest.resources.road_flow;if(!r)return null;
 const bad=()=>fail('INVALID_ROAD_FLOW','ROM 全程寻路资源标记、范围或入口不匹配');
 const integer=n=>Number.isSafeInteger(n)&&n>=0;
 if(r.schema!=='world.road-flow.v1'||![r.offset,r.length,r.code_offset,r.code_bytes,r.entry,r.goal_count,r.sector_count].every(integer)||
    r.offset<0x200||r.length<1||r.code_bytes<1||r.code_offset<=r.offset||r.code_offset+r.code_bytes!==r.offset+r.length||
    r.offset+r.length>directory.payloadOffset||r.entry<r.code_offset||r.entry>=r.offset+r.length||
    r.goal_count<1||r.goal_count>1024||r.sector_count<1||r.sector_count>65535)bad();
 const tables=r.editor_tables;if(tables&&(tables.schema!=='world.road-flow-tables.v1'||!integer(tables.offset)||!integer(tables.length)||!integer(tables.capacity)||tables.offset<r.code_offset+r.code_bytes||tables.length<1||tables.capacity<tables.length||tables.offset+tables.capacity>directory.payloadOffset))bad();
 const tableStart=tables?.offset??r.offset,tableEnd=tables?tables.offset+tables.length:r.code_offset;
 const s=r.symbols,keys=['RF_ATLAS','RF_PAGES','RF_ROOTS','RF_GROUP_ATLAS','RF_GROUP_INDEX','RF_ID_ROWS','RF_NEIGHBORS','RF_GOALS'];
 if(!s||keys.some(k=>!integer(s[k])||s[k]<tableStart||s[k]>=tableEnd)||keys.some((k,i)=>i&&s[k]<=s[keys[i-1]])||s.RF_ATLAS!==tableStart)bad();
 if(!integer(s.RF_ROOT_STRIDE)||s.RF_ROOT_STRIDE!==Math.ceil(r.sector_count/32)*2||!integer(s.RF_ID_COUNT)||s.RF_ID_COUNT<1||s.RF_ID_COUNT>65535||s.RF_GOAL_COUNT!==r.goal_count||
    (s.RF_PAGES-s.RF_ATLAS)%16||(s.RF_ROOTS-s.RF_PAGES)%64||
    s.RF_GROUP_ATLAS-s.RF_ROOTS!==r.goal_count*2*s.RF_ROOT_STRIDE||
    (s.RF_GROUP_INDEX-s.RF_GROUP_ATLAS)%128||s.RF_ID_ROWS-s.RF_GROUP_INDEX!==r.sector_count*2||
    s.RF_NEIGHBORS-s.RF_ID_ROWS!==s.RF_ID_COUNT*2||s.RF_GOALS-s.RF_NEIGHBORS!==r.sector_count*8||tableEnd-s.RF_GOALS!==r.goal_count*8)bad();
 const jump=(at,target)=>integer(target)&&target>=r.code_offset&&target<r.offset+r.length&&bytes[at]===0x4e&&bytes[at+1]===0xf9&&long(bytes,at+2)===target;
 if(!jump(0xfa7c,r.entry)||s.RF_PREVIOUS!==directory.manifest.resources.route_search?.code_offset)bad();
 if(r.buffer_entry!==undefined&&(!jump(0x10722,r.buffer_entry)||r.buffer_capacity!==20||!integer(r.query_entry)||r.query_entry<r.code_offset||r.query_entry>=r.offset+r.length))bad();
 return r;
}

export function requireExternalRoadRebuild(bytes){
 if(readRoadFlow(bytes))fail('ROAD_FLOW_REBUILD_REQUIRED','此 ROM 使用预编译全程寻路，地形或出入口修改需在 rebuild 工程重建；当前可浏览地图、绘制势力图');
}

export function supportsRoadFlowRebuild(bytes){const r=readRoadFlow(bytes);return !!r&&r.policy==='lexicographic-roads-first-v2'&&r.goal_count===r.symbols.RF_GOAL_COUNT;}
