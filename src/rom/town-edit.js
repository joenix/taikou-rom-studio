import {townSceneProfile} from './town-profile.js';
import {readWestLayout} from './west-layout.js';
import {readMapExtension} from './map-extension.js';
import {readTownInterior} from './town-interior.js';
import {readRomDirectory} from './rom-directory.js';
import {u16,span,integer,fail} from './codec.js';
export const FACILITY_NAMES=['宿屋','茶屋','医师','米店','马店'];
export const TOWN_GROUND=Array.from({length:20},(_,i)=>68+i).filter(n=>n!==83&&n!==84);
export const TOWN_DECORATIONS=[{code:17,name:'树木一'},{code:18,name:'树木二'},{code:19,name:'树木三'},{code:50,name:'围栏'},{code:85,name:'田地'},{code:41,name:'马匹'},{code:42,name:'米俵'},{code:43,name:'石制摆件'},{code:44,name:'小祠'},{code:61,name:'木桶'},{code:68,name:'井'},{code:69,name:'石碑'},{code:79,name:'树木'}];
export const TOWN_PAINTABLE=[...new Set([...TOWN_GROUND,...TOWN_DECORATIONS.map(t=>t.code)])];
const GARDEN_TILES=[{code:20,name:'池塘左侧'},{code:21,name:'池塘右侧'},{code:37,name:'板围栏左侧'},{code:38,name:'板围栏右侧'},{code:39,name:'木围栏左侧'},{code:40,name:'木围栏右侧'}];
const WOOD_WALLS=[50,51,52,53,54,55,56,57].map((code,i)=>({code,name:'木围墙'+['左上角','上横段','右上角','左竖段','横段','右竖段','左下角','右下角'][i]}));
const PORT_WALLS=[{code:65,name:'围墙左上角'},{code:66,name:'围墙横段'},{code:67,name:'围墙右上角'},{code:68,name:'围墙竖段'},{code:69,name:'围墙左下角'},{code:70,name:'围墙右下角'},{code:87,name:'院门左侧'},{code:88,name:'院门右侧'}];
export function townPaintPalette(bytes,id){
 const {profile}=townSceneProfile(bytes,id),ground=profile===1?TOWN_GROUND:[80,81,82,85,86,87];
 const base=profile===1?TOWN_DECORATIONS:TOWN_DECORATIONS.filter(t=>[17,18,19,41,42,43,44,85].includes(t.code));
 const decorations=[...new Map([...base,...GARDEN_TILES,...(profile===1?WOOD_WALLS:profile===2?PORT_WALLS:[])].map(t=>[t.code,t])).values()];
 return {ground,decorations,paintable:[...new Set([...ground,...decorations.map(t=>t.code)])]};
}
const PORT_MOTIFS=[{name:'住宅',tiles:[45,46,47,48,89,49],width:3},{name:'商人宅',tiles:[57,58,59,60,98,61],width:3},{name:'住宅',tiles:[0,1,2,3,90,4],width:3},{name:'茶人宅',tiles:[62,63,64,99],width:2},{name:'南蛮商馆',tiles:[54,55,56,102],width:2},{name:'南蛮寺',tiles:[49,50,51,52,53,101],width:2}];
const WALK=new Set([80,81,82,83,84,85,86,87,105]);
const long=(b,p)=>u16(b,p)*65536+u16(b,p+2);
const motifs=[{name:'住宅',tiles:[45,46,47,48,89,49],width:3},{name:'住宅',tiles:[45,46,47,48,96,49],width:3},{name:'住宅',tiles:[0,1,2,3,90,4],width:3},{name:'道场',tiles:[50,51,52,53,54,55,56,97,57],width:3},{name:'道场',tiles:[58,59,60,61,98,62],width:3},{name:'道场',tiles:[63,64,65,99],width:2},{name:'住宅',tiles:[49,50,51,52,53,101],width:2},{name:'住宅',tiles:[54,55,56,102],width:2}];
function reach(cells,seed){const seen=new Set([seed.y*32+seed.x]),q=[seed];for(const {x,y}of q)for(const [xx,yy]of [[x,y-1],[x+1,y],[x,y+1],[x-1,y]]){const i=yy*32+xx;if(xx>=0&&xx<32&&yy>=0&&yy<24&&!seen.has(i)&&WALK.has(cells[i])){seen.add(i);q.push({x:xx,y:yy});}}return seen;}
function bounds(r){for(const k of ['x','y','width','height'])integer(r[k],k==='x'||k==='y'?0:1,k==='x'||k==='width'?32:24,k);if(r.x+r.width>32||r.y+r.height>24)fail('INVALID_TOWN_EDIT','选区超出町内地图');return r;}
const contains=(r,x,y)=>x>=r.x&&x<r.x+r.width&&y>=r.y&&y<r.y+r.height;
export function townEditSnapshot(bytes,id){
 const sceneProfile=townSceneProfile(bytes,id),palette=townPaintPalette(bytes,id),map=readTownInterior(bytes,id),west=readWestLayout(bytes),ext=readMapExtension(bytes),t=west?.towns;
 const count=t?.town_count??(ext?18:17),interiors=t?.interiors??ext?.interiors??0xcc22e,index=t?.scene_index??0x764a8,bases=t?.bases??ext?.bases??0x761c6,entries=t?.entries??ext?.entries??0xd30da,entryCount=t?.entry_count??(ext?21:20),fa=long(bytes,0x2bcf2),facilityCount=t?.facility_count??90+Math.max(0,count-17)*5;
 // The old single-town installer never installed independent facility records.
 if(ext&&!west&&id===17)fail('UNSUPPORTED_TOWN_EDIT','此旧版新增町尚无独立设施表，请使用正式扩展版');
 span(bytes,fa,facilityCount*6);const facilities=[],spawns=[],offsets=[],blocks=new Set(),owners=new Map();
 for(let tid=0;tid<count;tid++)for(let sy=0;sy<3;sy++)for(let sx=0;sx<4;sx++){const block=u16(bytes,index+(u16(bytes,bases+tid*2)+sy*41+sx)*2);if(!owners.has(block))owners.set(block,new Set());owners.get(block).add(tid);}
 for(let y=0;y<24;y++)for(let x=0;x<32;x++){const block=u16(bytes,index+(map.base+(y>>>3)*41+(x>>>3))*2);if(!block||owners.get(block)?.size!==1)fail('SHARED_TOWN_BLOCK','此町有未分配或共用图块，暂不支持直接编辑');blocks.add(block);const at=interiors+(block-522)*64+(y&7)*8+(x&7);span(bytes,at,1);offsets.push(at);}
 const point=(sid,x,y)=>{const delta=sid-map.base,sy=Math.floor(delta/41),sx=delta%41;return sy>=0&&sy<3&&sx>=0&&sx<4&&x<8&&y<8?{x:sx*8+x,y:sy*8+y}:null;};
 for(let i=0;i<entryCount;i++){const at=entries+i*8,p=point(u16(bytes,at+4),bytes[at+6],bytes[at+7]);if(p)spawns.push({...p,record:i});}
 if(!spawns.length)fail('INVALID_TOWN_EDIT','找不到町内出生点');
 for(let i=0;i<facilityCount;i++){const at=fa+i*6,p=point(u16(bytes,at+2),bytes[at+4],bytes[at+5]);if(p){const kind=bytes[at];integer(kind,0,7,'设施类型');const x=p.x-(kind===1?0:1),y=p.y-1;if(x<0||y<0||x+2>32)fail('INVALID_TOWN_EDIT','设施建筑超出地图');facilities.push({kind,name:FACILITY_NAMES[kind]??'特殊设施',record:i,offset:at,door:p,x,y,width:2,height:2});}}
 const buildings=[...facilities];
 for(const m of (sceneProfile.profile===1?motifs:PORT_MOTIFS))for(let y=0;y<23;y++)for(let x=0;x<=32-m.width;x++)if(m.tiles.every((v,i)=>map.cells[(y+Math.floor(i/m.width))*32+x+i%m.width]===v)&&!buildings.some(f=>contains(f,x,y)))buildings.push({...m,x,y,height:m.tiles.length/m.width});
 // Roof95 has a variable-height middle and a separate59/60 facade row.
 const incomplete=[];
 if(sceneProfile.profile===1)for(let y=0;y<22;y++)for(let x=0;x<31;x++)if(map.cells[y*32+x]===56&&map.cells[y*32+x+1]===57){let bottom=y+1;while(bottom<23&&map.cells[bottom*32+x]===95&&map.cells[bottom*32+x+1]===58)bottom++;if(bottom===y+1)continue;const complete=map.cells[bottom*32+x]===59&&map.cells[bottom*32+x+1]===60;const f={name:complete?'长屋':'断开的长屋',x,y,width:2,height:bottom-y+1,broken:!complete};buildings.push(f);if(!complete)incomplete.push(f);}
 const orphans=[];if(sceneProfile.profile===1)for(let y=0;y<24;y++)for(let x=0;x<31;x++)if(map.cells[y*32+x]===59&&map.cells[y*32+x+1]===60&&!buildings.some(f=>!f.broken&&contains(f,x,y)))orphans.push({x,y});
 if(sceneProfile.buildings.length){
  buildings.length=0;
  for(const b of sceneProfile.buildings){
   let x,y,door;
   if(b.binding){const at=b.binding.offset;door=point(u16(bytes,at),bytes[at+2],bytes[at+3]);if(!door)fail('INVALID_TOWN_PROFILE','建筑入口不在此町');x=door.x-(b.door[0]-b.origin[0]);y=door.y-(b.door[1]-b.origin[1]);}
   else {const matches=[];for(let yy=0;yy<=24-b.height;yy++)for(let xx=0;xx<=32-b.width;xx++)if(b.tiles.every((v,i)=>map.cells[(yy+Math.floor(i/b.width))*32+xx+i%b.width]===v))matches.push({x:xx,y:yy});if(matches.length!==1)fail('INVALID_TOWN_PROFILE','町建筑图块不完整或重复');({x,y}=matches[0]);}
   bounds({x,y,width:b.width,height:b.height});if(!b.tiles.every((v,i)=>map.cells[(y+Math.floor(i/b.width))*32+x+i%b.width]===v))fail('INVALID_TOWN_PROFILE','建筑入口和完整图块不一致');
   const f={name:b.name,x,y,width:b.width,height:b.height,door};buildings.push(f);
   if(b.binding?.kind==='resident')facilities.push({...f,kind:8+b.binding.service,record:1000+b.binding.record,offset:b.binding.offset-2});
  }
 }
 const repairs=incomplete.length===1&&orphans.length===1?[{building:incomplete[0],orphan:orphans[0]}]:[];
 if(new Set(offsets).size!==768)fail('SHARED_TOWN_BLOCK','此町内部有共用图块，暂不支持直接编辑');
 const directory=readRomDirectory(bytes),limit=directory?.payloadOffset??bytes.length;
 if(offsets.some(p=>p<0x200||p>=limit)||facilities.some(f=>f.offset<0x200||f.offset+6>limit))fail('INVALID_TOWN_EDIT','町内资源越界');
 const decorations=Array.from(map.cells,(code,i)=>{const item=palette.decorations.find(t=>t.code===code);return item&&!buildings.some(f=>contains(f,i%32,Math.floor(i/32)))?{...item,x:i%32,y:Math.floor(i/32),width:1,height:1}:null;}).filter(Boolean);
 return {...map,id,palette,sceneProfile:sceneProfile.profile,offsets,facilities,buildings,decorations,spawns,repairs};
}
export function makeTownInteriorPatches(bytes,id,draft){
 const m=townEditSnapshot(bytes,id),cells=Array.from(m.cells),updates=new Map(),patches=[],moved=new Map(),doorMoves=new Map();
 const add=(offset,after)=>{if(bytes[offset]!==after)updates.set(offset,{offset,before:bytes[offset],after});};
 if(draft.action==='repair95'){
  if(!m.repairs.length)fail('NO_TOWN_REPAIR','没有可明确匹配的断开建筑');
  for(const {building:f,orphan:o}of m.repairs){const y=f.y+f.height-1,displaced=[];for(let i=0;i<2;i++){const code=cells[y*32+f.x+i];if(![80,81,82,85,86,87].includes(code)){if(!TOWN_DECORATIONS.some(t=>t.code===code))fail('TOWN_MOVE_COLLISION','建筑下方需要两格空地，请先移开其他建筑');displaced.push({i,code});}if(m.spawns.some(p=>p.x===f.x+i&&p.y===y)||m.buildings.some(b=>b!==f&&contains(b,f.x+i,y)))fail('TOWN_MOVE_COLLISION','建筑下方不能覆盖入口或其他建筑');}
   cells[o.y*32+o.x]=80;cells[o.y*32+o.x+1]=80;for(const d of displaced)cells[o.y*32+o.x+d.i]=d.code;cells[y*32+f.x]=59;cells[y*32+f.x+1]=60;}
 }else if(draft.action==='move'){
  const r=bounds(draft.rect);if(m.buildings.some(f=>f.broken&&contains(r,f.x,f.y)))fail('BROKEN_TOWN_BUILDING','请先点击「修复断开的建筑」，再整栋移动');integer(draft.x,0,31,'目标 X');integer(draft.y,0,23,'目标 Y');const target=bounds({...r,x:draft.x,y:draft.y}),dx=target.x-r.x,dy=target.y-r.y;
  if(!dx&&!dy)return {patches:[],label:'町内布局'};
  if(m.spawns.some(p=>contains(r,p.x,p.y)||contains(target,p.x,p.y)))fail('TOWN_ENTRY_PROTECTED','不能移动或覆盖町入口');
  for(let y=r.y;y<r.y+r.height;y++)for(let x=r.x;x<r.x+r.width;x++)if(cells[y*32+x]===105)fail('TOWN_EXIT_PROTECTED','出口不能移动');
  for(const f of m.buildings){const intersects=(a,b)=>a.x<b.x+b.width&&a.x+a.width>b.x&&a.y<b.y+b.height&&a.y+a.height>b.y;if(intersects(r,f)&&!(contains(r,f.x,f.y)&&contains(r,f.x+f.width-1,f.y+f.height-1)))fail('PARTIAL_TOWN_BUILDING','请选择完整建筑后再移动');}
  for(let y=r.y;y<r.y+r.height;y++)for(let x=r.x;x<r.x+r.width;x++)if(cells[y*32+x]>=88&&cells[y*32+x]<=104)doorMoves.set(y*32+x,(y+dy)*32+x+dx);
  const copy=[];for(let y=0;y<r.height;y++)for(let x=0;x<r.width;x++)copy.push(cells[(r.y+y)*32+r.x+x]);
  for(let y=target.y;y<target.y+target.height;y++)for(let x=target.x;x<target.x+target.width;x++)if(!contains(r,x,y)&&![80,81,82,85,86,87].includes(cells[y*32+x]))fail('TOWN_MOVE_COLLISION','目标区域有建筑或景物，请选择空地');
  for(let y=r.y;y<r.y+r.height;y++)for(let x=r.x;x<r.x+r.width;x++)cells[y*32+x]=80;
  for(let y=0;y<r.height;y++)for(let x=0;x<r.width;x++)cells[(target.y+y)*32+target.x+x]=copy[y*r.width+x];
  for(const f of m.facilities)if(contains(r,f.door.x,f.door.y)){const x=f.door.x+dx,y=f.door.y+dy,sid=m.base+(y>>>3)*41+(x>>>3);add(f.offset+2,sid>>>8);add(f.offset+3,sid&255);add(f.offset+4,x&7);add(f.offset+5,y&7);moved.set(f.record,{x,y});}
 }else if(draft.action==='paint'){
  let points;if(draft.cells!==undefined){if(!Array.isArray(draft.cells)||!draft.cells.length||draft.cells.length>768)fail('INVALID_TOWN_PAINT','每笔应为1至768格');points=draft.cells.map(p=>{integer(p.x,0,31,'X');integer(p.y,0,23,'Y');return p;});}else{const r=bounds(draft.rect);points=[];for(let y=r.y;y<r.y+r.height;y++)for(let x=r.x;x<r.x+r.width;x++)points.push({x,y});}if(!m.palette.paintable.includes(draft.code))fail('INVALID_TOWN_PAINT','请选择地形图块');
  for(const {x,y}of points){if(m.spawns.some(p=>p.x===x&&p.y===y)||cells[y*32+x]===105)fail('TOWN_ENTRY_PROTECTED','町入口和出口不可覆盖');if(m.buildings.some(f=>contains(f,x,y))||!m.palette.paintable.includes(cells[y*32+x]))fail('TOWN_BUILDING_PROTECTED','建筑请整栋移动，不能用地形覆盖');cells[y*32+x]=draft.code;}
 }else fail('INVALID_TOWN_EDIT','不支持的町内编辑操作');
 for(const seed of m.spawns){const old=reach(m.cells,seed),next=reach(cells,seed);
  const adjacent=(i,seen)=>{const x=i%32,y=Math.floor(i/32);return [[x,y-1],[x+1,y],[x,y+1],[x-1,y]].some(([xx,yy])=>xx>=0&&xx<32&&yy>=0&&yy<24&&seen.has(yy*32+xx));};
  for(let i=0;i<768;i++)if(m.cells[i]>=88&&m.cells[i]<=104&&adjacent(i,old)&&!adjacent(doorMoves.get(i)??i,next))fail('TOWN_ROUTE_BLOCKED','修改后有建筑入口无法到达');
  for(let i=0;i<768;i++)if(m.cells[i]===105&&old.has(i)&&!next.has(i))fail('TOWN_ROUTE_BLOCKED','修改后入口无法到达原有出口');for(const f of m.facilities){const before=(f.door.y+1)*32+f.door.x,p=moved.get(f.record)??f.door;if(old.has(before)&&!next.has((p.y+1)*32+p.x))fail('TOWN_ROUTE_BLOCKED',`修改后无法到达${f.name}门口`);}}
 for(let i=0;i<768;i++)add(m.offsets[i],cells[i]);patches.push(...updates.values());return {patches,label:`町内地图 #${id} · ${draft.action==='move'?'移动建筑／选区':draft.action==='repair95'?'修复断开的建筑':'绘制地形'}`};
}
