import {span,u16,decodeText,encodeField,integer,fail} from './codec.js';
import {PROFILE,hex} from './profile.js';
export const WORLD=Object.freeze({columns:41,rows:24,blockSize:8,width:328,height:192,indexBase:0x764a8,dataBase:0xc0826,blocks:521,townPointers:0x75d36,townBases:0x761c6,townEntrances:0xd30da,overviewBase:0xbfcdc});
const SIGNATURES=[{offset:0x17c22,hex:'23fc000c082600ffb460'},{offset:0xc0aa,hex:'207c000764a8'},{offset:0xf9a6,hex:'227c000d30da'},{offset:0xc284,hex:'d7c00c44007b6daa'},{offset:0x7484,hex:'207c000761c6'}];
export function mapCoordinate(bytes,x,y){
 integer(x,0,WORLD.width-1,'地图 X');integer(y,0,WORLD.height-1,'地图 Y');
 const mapId=Math.floor(y/8)*41+Math.floor(x/8),block=u16(bytes,WORLD.indexBase+mapId*2);
 if(!block||block>WORLD.blocks)fail('EMPTY_MAP_SECTOR','此位置没有已分配的大地图分区',{x,y,mapId});
 return {x,y,mapId,block,localX:x%8,localY:y%8,offset:WORLD.dataBase+(block-1)*64+(y%8)*8+x%8};
}
function coordinate(mapId,x,y){return {mapId,localX:x,localY:y,x:(mapId%41)*8+x,y:Math.floor(mapId/41)*8+y};}
function pointer(bytes,offset){return u16(bytes,offset)*65536+u16(bytes,offset+2);}
function townName(bytes,id){
 const offset=pointer(bytes,WORLD.townPointers+id*4);if(offset<0x72000||offset>=0x74000)fail('INVALID_TOWN_NAME_POINTER','町名称指针超出已验证文本区',{record:id,offset});
 let length=0;while(length<24&&span(bytes,offset+length,1)[0]!==0)length++;
 if(!length||length===24)fail('INVALID_TOWN_NAME','町名称不存在或未终止',{record:id,offset});
 return {name:decodeText(bytes,offset,length),nameOffset:offset,nameCapacity:length};
}
export function readMapPlaces(bytes){
 const castles=Array.from({length:123},(_,id)=>{
  const offset=PROFILE.castles.base+id*20,mapId=u16(bytes,offset+14),x=bytes[offset+16],y=bytes[offset+17];
  const aliases=[id];for(let i=123;i<125;i++){const p=PROFILE.castles.base+i*20;if(u16(bytes,p+14)===mapId&&bytes[p+16]===x&&bytes[p+17]===y)aliases.push(i);}
  return {kind:'map-castle',id,key:`castle:${id}`,name:decodeText(bytes,offset,9),offset,aliases,entrances:[{...coordinate(mapId,x,y),offset:offset+14,width:2}],...coordinate(mapId,x,y),overview:{x:bytes[WORLD.overviewBase+id*2],y:bytes[WORLD.overviewBase+id*2+1]}};
 });
 const entrances=Array.from({length:20},(_,slot)=>{const p=WORLD.townEntrances+slot*8;return {slot,offset:p,...coordinate(u16(bytes,p),bytes[p+2],bytes[p+3]),targetMap:u16(bytes,p+4),targetX:bytes[p+6],targetY:bytes[p+7],width:1};});
 const towns=Array.from({length:17},(_,id)=>{
  const base=u16(bytes,WORLD.townBases+id*2),rows=entrances.filter(e=>[0,41,82].some(bank=>e.targetMap>=base+bank&&e.targetMap<base+bank+4));
  if(!rows.length)fail('MISSING_TOWN_ENTRANCE','町缺少可识别的入口',{record:id});
  return {kind:'map-town',id,key:`town:${id}`,...townName(bytes,id),offset:rows[0].offset,entrances:rows,...coordinate(rows[0].mapId,rows[0].localX,rows[0].localY)};
 });
 return {castles,towns,all:[...castles,...towns]};
}
export function inspectWorldMap(bytes){
 try{
  for(const s of SIGNATURES){const actual=Array.from(span(bytes,s.offset,s.hex.length/2),b=>b.toString(16).padStart(2,'0')).join('');if(actual!==s.hex)fail('UNSUPPORTED_MAP_LAYOUT','大地图读取或入口代码不匹配',{offset:s.offset});}
  span(bytes,WORLD.dataBase,WORLD.blocks*64);
  const blocks=new Set();for(let id=0;id<984;id++){const block=u16(bytes,WORLD.indexBase+id*2);if(block){if(block>521||blocks.has(block))fail('ALIASED_MAP_BLOCK','大地图分区超出范围或共享数据块，不能安全独立编辑',{mapId:id,block});blocks.add(block);}}
  if(blocks.size!==521)fail('INVALID_MAP_BLOCKS','大地图的分区数量不是已核验的 521');
  const places=readMapPlaces(bytes);
  const claimed=new Set();
  const townSlots=places.towns.flatMap(p=>p.entrances.map(e=>e.slot));if(townSlots.length!==20||new Set(townSlots).size!==20)fail('AMBIGUOUS_TOWN_ENTRANCE','町入口分组不唯一或存在未识别入口');
  for(const p of places.all)for(const e of p.entrances){
   if(e.mapId>=984||e.localX>7||e.localY>7||(p.kind==='map-castle'&&e.localX>6))fail('INVALID_MAP_LOCATION','地点坐标超出当前大地图布局',{kind:p.kind,record:p.id});
   for(let col=0;col<e.width;col++){const key=`${e.x+col},${e.y}`;if(claimed.has(key))fail('OVERLAPPING_MAP_PLACES','地点入口重叠',{record:p.id});claimed.add(key);}
   const cell=mapCoordinate(bytes,e.x,e.y),value=bytes[cell.offset];
   if(p.kind==='map-castle'&&(!(value&0x80)||((bytes[cell.offset+1]&0x88)!==0x88)))fail('MISSING_CASTLE_MARKER','城池入口与地图标记不一致',{record:p.id,offset:cell.offset});
   if(p.kind==='map-town'&&(value<0x40||value>0x42))fail('MISSING_TOWN_MARKER','町入口与地图标记不一致',{record:p.id,offset:cell.offset});
  }
  return {supported:true,blocks:521,width:328,height:192,castles:123,towns:17};
 }catch(error){return {supported:false,error:{code:error.code||'MAP_ERROR',message:error.message,details:error.details}};}
}
export function requireWorldMap(bytes){const result=inspectWorldMap(bytes);if(!result.supported)fail(result.error.code,result.error.message,result.error.details);return result;}
export function readWorldMap(bytes){
 requireWorldMap(bytes);const cells=new Int16Array(WORLD.width*WORLD.height).fill(-1),counts=new Map();
 for(let y=0;y<WORLD.height;y++)for(let x=0;x<WORLD.width;x++){
  const id=Math.floor(y/8)*41+Math.floor(x/8),block=u16(bytes,WORLD.indexBase+id*2);if(!block)continue;
  const code=bytes[WORLD.dataBase+(block-1)*64+(y%8)*8+x%8];cells[y*WORLD.width+x]=code;counts.set(code,(counts.get(code)||0)+1);
 }
 return {...WORLD,cells,palette:[...counts.entries()].filter(([code])=>code<64).sort((a,b)=>b[1]-a[1]).map(([code,count])=>({code,count})),places:readMapPlaces(bytes)};
}
export function terrainLabel(code){return code<0?'未分配分区':code>=128?'城池标记':code>=64?'町／特殊入口':`地形 ${hex(code,2)}`;}
export function terrainColor(code){
 if(code<0)return '#e8ebee';if(code>=128)return '#8c4451';if(code>=64)return '#c58a48';
 // Symbolic index colors, intentionally not a claim about the game's palette or terrain semantics.
 if(code===53)return '#aac4d1';if(code===19)return '#d5d2a1';if(code===55)return '#839b80';
 const h=(code*31+65)%130,s=20+(code%4)*5,l=48+(code%5)*7;return `hsl(${h} ${s}% ${l}%)`;
}
export function makeTerrainPatches(bytes,draft){
 requireWorldMap(bytes);for(const key of Object.keys(draft))if(!['x0','y0','x1','y1','code'].includes(key))fail('UNSUPPORTED_FIELD',`未开放地形字段 ${key}`);const {x0,y0,x1=x0,y1=y0,code}=draft;integer(code,0,63,'地形原码');
 for(const [v,label,max] of [[x0,'起点 X',327],[x1,'终点 X',327],[y0,'起点 Y',191],[y1,'终点 Y',191]])integer(v,0,max,label);
 const left=Math.min(x0,x1),right=Math.max(x0,x1),top=Math.min(y0,y1),bottom=Math.max(y0,y1);
 if((right-left+1)*(bottom-top+1)>4096)fail('MAP_SELECTION_TOO_LARGE','一次最多修改 4096 格，请缩小选区');
 const patches=[];
 for(let y=top;y<=bottom;y++)for(let x=left;x<=right;x++){
  const {offset}=mapCoordinate(bytes,x,y),before=bytes[offset];
  if(before>=64)fail('PROTECTED_LOCATION_CELL','选区包含城或町入口，请使用地点编辑，不能用地形笔刷覆盖',{x,y,offset});
  if(before!==code)patches.push({offset,before,after:code});
 }
 return {patches,label:`地形选区 (${left},${top})–(${right},${bottom}) → ${hex(code,2)}`,selection:{x0:left,y0:top,x1:right,y1:bottom}};
}
export function makePlacePatches(bytes,kind,id,draft){
 requireWorldMap(bytes);const places=readMapPlaces(bytes),place=(kind==='map-castle'?places.castles:kind==='map-town'?places.towns:[]).find(p=>p.id===id);
 if(!place)fail('INVALID_MAP_PLACE','地点不存在');
 const allowed=kind==='map-castle'?['name','x','y','fillCode','overviewX','overviewY']:['name','x','y','fillCode'];
 for(const key of Object.keys(draft))if(!allowed.includes(key))fail('UNSUPPORTED_FIELD',`未开放地点字段 ${key}`);
 const edits=new Map();const add=(offset,data)=>{span(bytes,offset,data.length);for(let i=0;i<data.length;i++){if(bytes[offset+i]!==data[i])edits.set(offset+i,data[i]);else edits.delete(offset+i);}};
 if(draft.name!==undefined&&draft.name!==place.name){const offset=kind==='map-castle'?place.offset:place.nameOffset,capacity=kind==='map-castle'?9:place.nameCapacity;add(offset,encodeField(draft.name,capacity,span(bytes,offset,capacity)));}
 if(draft.x!==undefined||draft.y!==undefined){
  const x=draft.x??place.x,y=draft.y??place.y;integer(x,0,327,'地点 X');integer(y,0,191,'地点 Y');
  if(x!==place.x||y!==place.y){
   const fill=integer(draft.fillCode,0,63,'原址回填地形'),dx=x-place.x,dy=y-place.y;
   const sourceCells=new Set(),sourceCodes=[];
   for(const entry of place.entrances)for(let col=0;col<entry.width;col++){const cell=mapCoordinate(bytes,entry.x+col,entry.y);sourceCells.add(cell.offset);sourceCodes.push({x:entry.x+col,y:entry.y,code:bytes[cell.offset]});}
   const occupied=new Set(places.all.filter(p=>p.key!==place.key).flatMap(p=>p.entrances.flatMap(e=>Array.from({length:e.width},(_,i)=>`${e.x+i},${e.y}`))));
   for(const source of sourceCodes){const nx=source.x+dx,ny=source.y+dy,target=mapCoordinate(bytes,nx,ny);if(occupied.has(`${nx},${ny}`)||(!sourceCells.has(target.offset)&&bytes[target.offset]>=64))fail('LOCATION_CONFLICT','目标位置与其他地点或特殊入口冲突',{x:nx,y:ny});}
   if(kind==='map-castle'&&x%8>6)fail('CASTLE_CROSSES_SECTOR','城池占两格，入口不能放在分区最右一列');
   for(const offset of sourceCells)add(offset,[fill]);
   for(const source of sourceCodes)add(mapCoordinate(bytes,source.x+dx,source.y+dy).offset,[source.code]);
   for(const entry of place.entrances){const target=mapCoordinate(bytes,entry.x+dx,entry.y+dy);add(entry.offset,[target.mapId>>>8,target.mapId&255,target.localX,target.localY]);}
   if(kind==='map-castle')for(const alias of place.aliases.filter(i=>i!==id)){const target=mapCoordinate(bytes,x,y);add(PROFILE.castles.base+alias*20+14,[target.mapId>>>8,target.mapId&255,target.localX,target.localY]);}
  }
 }
 if(kind==='map-castle'){
  if(draft.overviewX!==undefined)add(WORLD.overviewBase+id*2,[integer(draft.overviewX,0,63,'总览图 X')]);
  if(draft.overviewY!==undefined)add(WORLD.overviewBase+id*2+1,[integer(draft.overviewY,0,24,'总览图 Y')]);
 }
 const patches=[...edits].sort((a,b)=>a[0]-b[0]).map(([offset,after])=>({offset,before:bytes[offset],after}));
 return {patches,label:`${kind==='map-castle'?'城':'町'} · ${place.name}`,place};
}
