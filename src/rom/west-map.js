import {readWestLayout,long} from './west-layout.js';
import {u16,decodeText,integer,fail,span} from './codec.js';
const cache=new WeakMap();
export function westCoordinate(bytes,x,y){
 const l=readWestLayout(bytes);const {minX,maxX,minY,maxY}=l;integer(x,minX,maxX,'地图 X');integer(y,minY,maxY,'地图 Y');const row=l.byXY.get(`${Math.floor(x/8)},${Math.floor(y/8)}`);if(!row)fail('EMPTY_MAP_SECTOR','这里是预览补海，没有可写入的地图资源',{x,y});
 const localX=((x%8)+8)%8,localY=((y%8)+8)%8;return {x,y,mapId:row.id,localX,localY,offset:row.pointer+localY*8+localX};
}
function position(l,sid,x,y){const r=l.byId.get(sid);if(!r)fail('INVALID_MAP_LOCATION','地点指向未分配的分区');return {mapId:sid,localX:x,localY:y,x:r.x*8+x,y:r.y*8+y};}
function terminated(b,p){span(b,p,1);let n=0;while(n<32&&b[p+n])n++;if(!n||n===32)fail('INVALID_TOWN_NAME','地点名称未终止');return decodeText(b,p,n);}
export function readWestPlaces(bytes){
 const l=readWestLayout(bytes),castles=Array.from({length:123},(_,id)=>{const p=0x77952+id*20,pos=position(l,u16(bytes,p+14),bytes[p+16],bytes[p+17]),aliases=[id];if(id===79)aliases.push(123);if(id===91)aliases.push(124);return {kind:'map-castle',id,key:`castle:${id}`,name:decodeText(bytes,p,9),offset:p,aliases,...pos,entrances:[{...pos,width:2}],style:(bytes[0x7aab8+id*18+15]&3)|4};});
 const entrances=Array.from({length:l.towns.entry_count},(_,slot)=>{const p=l.towns.entries+slot*8;return {slot,offset:p,...position(l,u16(bytes,p),bytes[p+2],bytes[p+3]),targetMap:u16(bytes,p+4),targetX:bytes[p+6],targetY:bytes[p+7],width:1};});
 const towns=Array.from({length:l.towns.town_count},(_,id)=>{const base=u16(bytes,l.towns.bases+id*2),es=entrances.filter(e=>[0,41,82].some(bank=>e.targetMap>=base+bank&&e.targetMap<base+bank+4));if(!es.length)fail('MISSING_TOWN_ENTRANCE','町没有可识别入口');const pos=es[0];return {kind:'map-town',id,key:`town:${id}`,name:terminated(bytes,long(bytes,l.towns.names+id*4)),active:true,editorCreated:false,base,...pos,entrances:es};});
 for(let i=0;i<l.placeCount;i++){
  const p=l.placeRecords+i*16,id=u16(bytes,p);if(bytes[p+2]!==1)continue;const pos=position(l,u16(bytes,p+4),bytes[p+6],bytes[p+7]);
  castles.push({kind:'map-castle',id,key:`gate:${id}`,name:terminated(bytes,long(bytes,p+8)),readOnlyGate:true,aliases:[id],...pos,entrances:[{...pos,width:2}],style:bytes[westCoordinate(bytes,pos.x,pos.y).offset]>>>4&7});
 }
 return {castles,towns,all:[...castles,...towns]};
}
export function readWestMap(bytes){
 if(cache.has(bytes))return cache.get(bytes);const l=readWestLayout(bytes),minX=l.minX,minY=l.minY,maxX=l.maxX,maxY=l.maxY,width=maxX-minX+1,height=maxY-minY+1,cells=new Int16Array(width*height).fill(-1),counts=new Map();
 for(const row of l.rows)for(let i=0;i<64;i++){const code=bytes[row.pointer+i],x=row.x*8+i%8,y=row.y*8+Math.floor(i/8);cells[(y-minY)*width+x-minX]=code;counts.set(code,(counts.get(code)||0)+1);}
 const places=readWestPlaces(bytes);for(const p of places.all)for(const e of p.entrances){const code=bytes[westCoordinate(bytes,e.x,e.y).offset];if(p.kind==='map-castle'&&(!(code&128)||!(bytes[westCoordinate(bytes,e.x+1,e.y).offset]&136)))fail('MISSING_CASTLE_MARKER','城池标记不完整');if(p.kind==='map-town'&&(code<64||code>66))fail('MISSING_TOWN_MARKER','町标记不完整');}
 const map={layout:'west-catalog',width,height,minX,minY,maxX,maxY,blocks:l.rows.length,originalSectorIds:l.rows.filter(r=>r.id<1230).map(r=>r.id),cells,places,palette:[...counts].filter(([code])=>code<64).map(([code,count])=>({code,count}))};cache.set(bytes,map);return map;
}
export function westTerrainPatches(bytes,draft){
 const l=readWestLayout(bytes),points=draft.cells??null;let cells;
 if(points){if(!Array.isArray(points)||points.length>4096)fail('MAP_SELECTION_TOO_LARGE','每笔最多4096格');cells=points;}
 else{const {x0,y0,x1=x0,y1=y0,code}=draft;for(const v of [x0,x1,y0,y1])if(!Number.isInteger(v))fail('INVALID_FIELD','选区坐标必须是整数');if((Math.abs(x1-x0)+1)*(Math.abs(y1-y0)+1)>4096)fail('MAP_SELECTION_TOO_LARGE','每笔最多4096格');cells=[];for(let y=Math.min(y0,y1);y<=Math.max(y0,y1);y++)for(let x=Math.min(x0,x1);x<=Math.max(x0,x1);x++)cells.push({x,y,code});}
 const protectedCells=new Set();for(const p of readWestPlaces(bytes).all)for(const e of p.entrances)for(let dx=0;dx<e.width;dx++)for(let dy=p.kind==='map-castle'?-1:0;dy<=0;dy++)protectedCells.add(`${e.x+dx},${e.y+dy}`);
 const edits=new Map();for(const c of cells){integer(c.code,0,63,'图块编号');const {offset,mapId}=westCoordinate(bytes,c.x,c.y);if(mapId<1230&&draft.allowOriginal!==true)fail('ORIGINAL_MAP_LOCKED','原版地图已锁定，请先开启「允许修改原图」',{x:c.x,y:c.y});if(bytes[offset]>=64||protectedCells.has(`${c.x},${c.y}`))fail('PROTECTED_LOCATION_CELL','城、町和城门整体受保护，笔刷未提交',{x:c.x,y:c.y});edits.set(offset,c.code);}
 return {patches:[...edits].filter(([p,v])=>bytes[p]!==v).map(([offset,after])=>({offset,before:bytes[offset],after})),label:`地图笔刷 · ${edits.size} 格`};
}
