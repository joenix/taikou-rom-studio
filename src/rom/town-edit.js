import {readWestLayout} from './west-layout.js';
import {readMapExtension} from './map-extension.js';
import {readTownInterior} from './town-interior.js';
import {readRomDirectory} from './rom-directory.js';
import {u16,span,integer,fail} from './codec.js';
export const FACILITY_NAMES=['宿屋','茶屋','医师','米店','马店'];
export const TOWN_GROUND=Array.from({length:20},(_,i)=>68+i).filter(n=>n!==83&&n!==84);
const WALK=new Set([80,81,82,83,84,85,86,87,105]);
const long=(b,p)=>u16(b,p)*65536+u16(b,p+2);
const motifs=[{name:'住宅',tiles:[45,46,47,48,89,49],width:3},{name:'住宅',tiles:[45,46,47,48,96,49],width:3},{name:'住宅',tiles:[0,1,2,3,90,4],width:3},{name:'道场',tiles:[53,54,55,56,97,57],width:3},{name:'道场',tiles:[58,59,60,61,98,62],width:3},{name:'道场',tiles:[63,64,65,99],width:2},{name:'住宅',tiles:[51,52,53,101],width:2},{name:'住宅',tiles:[54,55,56,102],width:2},{name:'住宅',tiles:[56,57,95,58],width:2}];
function reach(cells,seed){const seen=new Set([seed.y*32+seed.x]),q=[seed];for(const {x,y}of q)for(const [xx,yy]of [[x,y-1],[x+1,y],[x,y+1],[x-1,y]]){const i=yy*32+xx;if(xx>=0&&xx<32&&yy>=0&&yy<24&&!seen.has(i)&&WALK.has(cells[i])){seen.add(i);q.push({x:xx,y:yy});}}return seen;}
function bounds(r){for(const k of ['x','y','width','height'])integer(r[k],k==='x'||k==='y'?0:1,k==='x'||k==='width'?32:24,k);if(r.x+r.width>32||r.y+r.height>24)fail('INVALID_TOWN_EDIT','选区超出町内地图');return r;}
const contains=(r,x,y)=>x>=r.x&&x<r.x+r.width&&y>=r.y&&y<r.y+r.height;
export function townEditSnapshot(bytes,id){
 const map=readTownInterior(bytes,id),west=readWestLayout(bytes),ext=readMapExtension(bytes),t=west?.towns;
 const count=t?.town_count??(ext?18:17),interiors=t?.interiors??ext?.interiors??0xcc22e,index=t?.scene_index??0x764a8,bases=t?.bases??ext?.bases??0x761c6,entries=t?.entries??ext?.entries??0xd30da,entryCount=t?.entry_count??(ext?21:20),fa=long(bytes,0x2bcf2),facilityCount=90+Math.max(0,count-17)*5;
 // The old single-town installer never installed independent facility records.
 if(ext&&!west&&id===17)fail('UNSUPPORTED_TOWN_EDIT','此旧版新增町尚无独立设施表，请使用正式扩展版');
 span(bytes,fa,facilityCount*6);const facilities=[],spawns=[],offsets=[],blocks=new Set(),owners=new Map();
 for(let tid=0;tid<count;tid++)for(let sy=0;sy<3;sy++)for(let sx=0;sx<4;sx++){const block=u16(bytes,index+(u16(bytes,bases+tid*2)+sy*41+sx)*2);if(!owners.has(block))owners.set(block,new Set());owners.get(block).add(tid);}
 for(let y=0;y<24;y++)for(let x=0;x<32;x++){const block=u16(bytes,index+(map.base+(y>>>3)*41+(x>>>3))*2);if(!block||owners.get(block)?.size!==1)fail('SHARED_TOWN_BLOCK','此町有未分配或共用图块，暂不支持直接编辑');blocks.add(block);const at=interiors+(block-522)*64+(y&7)*8+(x&7);span(bytes,at,1);offsets.push(at);}
 const point=(sid,x,y)=>{const delta=sid-map.base,sy=Math.floor(delta/41),sx=delta%41;return sy>=0&&sy<3&&sx>=0&&sx<4&&x<8&&y<8?{x:sx*8+x,y:sy*8+y}:null;};
 for(let i=0;i<entryCount;i++){const at=entries+i*8,p=point(u16(bytes,at+4),bytes[at+6],bytes[at+7]);if(p)spawns.push({...p,record:i});}
 if(!spawns.length)fail('INVALID_TOWN_EDIT','找不到町内出生点');
 for(let i=0;i<facilityCount;i++){const at=fa+i*6,p=point(u16(bytes,at+2),bytes[at+4],bytes[at+5]);if(p){const kind=bytes[at];integer(kind,0,7,'设施类型');const x=kind>4?p.x:p.x-(kind===1?0:1),y=kind>4?p.y:p.y-1;if(x<0||y<0||x+2>32)fail('INVALID_TOWN_EDIT','设施建筑超出地图');facilities.push({kind,name:FACILITY_NAMES[kind]??'特殊设施',record:i,offset:at,door:p,x,y,width:kind>4?1:2,height:kind>4?1:2});}}
 const buildings=facilities.filter(f=>f.kind<=4);
 for(const m of motifs)for(let y=0;y<23;y++)for(let x=0;x<=32-m.width;x++)if(m.tiles.every((v,i)=>map.cells[(y+Math.floor(i/m.width))*32+x+i%m.width]===v)&&!buildings.some(f=>contains(f,x,y)))buildings.push({...m,x,y,height:2});
 if(new Set(offsets).size!==768)fail('SHARED_TOWN_BLOCK','此町内部有共用图块，暂不支持直接编辑');
 const directory=readRomDirectory(bytes),limit=directory?.payloadOffset??bytes.length;
 if(offsets.some(p=>p<0x200||p>=limit)||facilities.some(f=>f.offset<0x200||f.offset+6>limit))fail('INVALID_TOWN_EDIT','町内资源越界');
 return {...map,id,offsets,facilities,buildings,spawns};
}
export function makeTownInteriorPatches(bytes,id,draft){
 const m=townEditSnapshot(bytes,id),cells=Array.from(m.cells),updates=new Map(),patches=[],moved=new Map(),doorMoves=new Map();
 const add=(offset,after)=>{if(bytes[offset]!==after)updates.set(offset,{offset,before:bytes[offset],after});};
 if(draft.action==='move'){
  const r=bounds(draft.rect);integer(draft.x,0,31,'目标 X');integer(draft.y,0,23,'目标 Y');const target=bounds({...r,x:draft.x,y:draft.y}),dx=target.x-r.x,dy=target.y-r.y;
  if(!dx&&!dy)return {patches:[],label:'町内布局'};
  if(m.spawns.some(p=>contains(r,p.x,p.y)||contains(target,p.x,p.y)))fail('TOWN_ENTRY_PROTECTED','不能移动或覆盖町入口');
  for(let y=r.y;y<r.y+r.height;y++)for(let x=r.x;x<r.x+r.width;x++)if(cells[y*32+x]===105)fail('TOWN_EXIT_PROTECTED','出口不能移动');
  for(const f of m.buildings){const intersects=(a,b)=>a.x<b.x+b.width&&a.x+a.width>b.x&&a.y<b.y+b.height&&a.y+a.height>b.y;if(intersects(r,f)&&!(contains(r,f.x,f.y)&&contains(r,f.x+f.width-1,f.y+f.height-1)))fail('PARTIAL_TOWN_BUILDING','请选择完整建筑后再移动');}
  for(let y=r.y;y<r.y+r.height;y++)for(let x=r.x;x<r.x+r.width;x++)if(cells[y*32+x]>=88&&cells[y*32+x]<=104)doorMoves.set(y*32+x,(y+dy)*32+x+dx);
  const copy=[];for(let y=0;y<r.height;y++)for(let x=0;x<r.width;x++)copy.push(cells[(r.y+y)*32+r.x+x]);
  for(let y=target.y;y<target.y+target.height;y++)for(let x=target.x;x<target.x+target.width;x++)if(!contains(r,x,y)&&![80,81].includes(cells[y*32+x]))fail('TOWN_MOVE_COLLISION','目标区域有建筑或景物，请选择空地');
  for(let y=r.y;y<r.y+r.height;y++)for(let x=r.x;x<r.x+r.width;x++)cells[y*32+x]=80;
  for(let y=0;y<r.height;y++)for(let x=0;x<r.width;x++)cells[(target.y+y)*32+target.x+x]=copy[y*r.width+x];
  for(const f of m.facilities)if(contains(r,f.door.x,f.door.y)){const x=f.door.x+dx,y=f.door.y+dy,sid=m.base+(y>>>3)*41+(x>>>3);add(f.offset+2,sid>>>8);add(f.offset+3,sid&255);add(f.offset+4,x&7);add(f.offset+5,y&7);moved.set(f.record,{x,y});}
 }else if(draft.action==='paint'){
  const r=bounds(draft.rect);if(!TOWN_GROUND.includes(draft.code))fail('INVALID_TOWN_PAINT','请选择地形图块');
  for(let y=r.y;y<r.y+r.height;y++)for(let x=r.x;x<r.x+r.width;x++){if(m.spawns.some(p=>p.x===x&&p.y===y)||cells[y*32+x]===105)fail('TOWN_ENTRY_PROTECTED','町入口和出口不可覆盖');if(!TOWN_GROUND.includes(cells[y*32+x]))fail('TOWN_BUILDING_PROTECTED','建筑请整栋移动，不能用地形覆盖');cells[y*32+x]=draft.code;}
 }else fail('INVALID_TOWN_EDIT','不支持的町内编辑操作');
 for(const seed of m.spawns){const old=reach(m.cells,seed),next=reach(cells,seed);
  const adjacent=(i,seen)=>{const x=i%32,y=Math.floor(i/32);return [[x,y-1],[x+1,y],[x,y+1],[x-1,y]].some(([xx,yy])=>xx>=0&&xx<32&&yy>=0&&yy<24&&seen.has(yy*32+xx));};
  for(let i=0;i<768;i++)if(m.cells[i]>=88&&m.cells[i]<=104&&adjacent(i,old)&&!adjacent(doorMoves.get(i)??i,next))fail('TOWN_ROUTE_BLOCKED','修改后有建筑入口无法到达');
  for(let i=0;i<768;i++)if(m.cells[i]===105&&old.has(i)&&!next.has(i))fail('TOWN_ROUTE_BLOCKED','修改后入口无法到达原有出口');for(const f of m.facilities){const before=(f.door.y+1)*32+f.door.x,p=moved.get(f.record)??f.door;if(old.has(before)&&!next.has((p.y+1)*32+p.x))fail('TOWN_ROUTE_BLOCKED',`修改后无法到达${f.name}门口`);}}
 for(let i=0;i<768;i++)add(m.offsets[i],cells[i]);patches.push(...updates.values());return {patches,label:`町内地图 #${id} · ${draft.action==='move'?'移动建筑／选区':'绘制地形'}`};
}
