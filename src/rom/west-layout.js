import LEGACY from './layouts/west-v14023.json' with {type:'json'};
import JAPAN from './layouts/japan-v14026.json' with {type:'json'};
import JAPAN27 from './layouts/japan-v14027.json' with {type:'json'};
import JAPAN28 from './layouts/japan-v14028.json' with {type:'json'};
import JAPAN29 from './layouts/japan-v14029.json' with {type:'json'};
import JAPAN31 from './layouts/japan-v14031.json' with {type:'json'};
import JAPAN32 from './layouts/japan-v14032.json' with {type:'json'};
import JAPAN33 from './layouts/japan-v14033.json' with {type:'json'};
import {readRomDirectory} from './rom-directory.js';
import {readRoadFlow} from './road-flow.js';
import {worldLayoutContract} from './world-layout-contract.js';
const L=LEGACY;
const JAPAN142={...JAPAN33,version:'1.42',title:'TAIKOU PRO V1.42 FACTION BASE',fexObjectBytes:0xdea};
import {span,u16,fail} from './codec.js';
export {L as WEST_LAYOUT};
export const long=(b,p)=>u16(b,p)*65536+u16(b,p+2);
export function put(b,p,value,width=4){for(let i=width-1;i>=0;i--){b[p+i]=value&255;value=Math.floor(value/256);}}
const decoder=new TextDecoder(),cache=new WeakMap();
export function worldLayoutSpec(bytes){
 const directory=readRomDirectory(bytes),layoutId=directory?.manifest.resources.world_map?.layout_id;
 const marked=layoutId==='japan-v14033'?JAPAN142:null;
 if(marked&&bytes.length>=marked.baseLength&&long(bytes,marked.directoryOffset+20)===marked.codeOffset)return marked;
 const title=decoder.decode(bytes.subarray(0x120,0x150)).trim();
 return [JAPAN142,JAPAN33,JAPAN32,JAPAN31,JAPAN29,JAPAN28,JAPAN27,JAPAN,LEGACY].find(l=>l.title===title&&bytes.length>=l.baseLength&&long(bytes,l.directoryOffset+20)===l.codeOffset)??null;
}
export function isWestRom(bytes){return Boolean(worldLayoutSpec(bytes));}
export function westNavigation(bytes){
 const L=worldLayoutSpec(bytes);if(!L)return null;
 // The reserved slot can be followed by the existing item-icon extension.
 for(let p=L.baseLength;p<=bytes.length-16;p+=2){
  if(bytes[p]!==84||bytes[p+1]!==75||decoder.decode(bytes.subarray(p,p+8))!=='TKWNAV01')continue;
  const start=long(bytes,p+8),size=long(bytes,p+12),expectedFooter=start+size-16;
  const relocatedV142Footer=L.version==='1.42'&&p===bytes.length-16&&p-expectedFooter===L.fexObjectBytes;
  if(size!==L.navSlotSize||expectedFooter!==p&&!relocatedV142Footer||start<L.baseLength)fail('INVALID_WEST_NAV','寻路资源目录范围异常');
  const version=L.navigationStorage==='fixed-capacity-banks'?3:L.navigationStorage==='original-maps-appended-banks'?2:1;
  if(decoder.decode(span(bytes,start,8))!==`TKWNAVD${version}`)fail('INVALID_WEST_NAV','寻路资源标记异常');
  let meta;try{meta=JSON.parse(decoder.decode(span(bytes,start+16,4080)).replace(/\0+$/,''));}catch{fail('INVALID_WEST_NAV','寻路资源目录无法读取');}
  if(meta.version!==version||meta.graphLength<=0||(version===3?meta.graphStart!==0:meta.graphStart!==start+4096||meta.graphStart+meta.graphLength>p))fail('INVALID_WEST_NAV','寻路资源长度异常');
  for(const mode of ['land','sailing']){
   const g=meta.components[mode],fixedMap=L.navigation[mode.toUpperCase()+'_MAP'];
   if(!g||!Number.isInteger(g.nodes)||g.nodes<1||g.nodes>L.graphCapacity||(version===3?g.nodesAt!==L.fixedBanks?.[mode]?.start||g.nodesAt+g.nodes*8>L.fixedBanks[mode].start+L.fixedBanks[mode].capacity:g.nodesAt<start+4096||g.nodesAt+g.nodes*8>p))fail('INVALID_WEST_NAV','寻路分区数量或指针异常');
   if(version===1?g.map<start+4096||g.nodesAt<g.map:g.map!==fixedMap)fail('INVALID_WEST_NAV','寻路索引地址异常');
   span(bytes,g.map,(L.sectorCount??585)*128);span(bytes,g.nodesAt,g.nodes*8);
  }
  if(version>=2)validateSplitGraph(bytes,L,meta,p);
  return {...meta,start,size,end:p+16,values:{LAND_MAP:meta.components.land.map,LAND_NODES:meta.components.land.nodesAt,LAND_COUNT:meta.components.land.nodes,SAILING_MAP:meta.components.sailing.map,SAILING_NODES:meta.components.sailing.nodesAt,SAILING_COUNT:meta.components.sailing.nodes}};
 }
 return null;
}
export function readWestLayout(bytes,{fresh=false}={}){
 const base=worldLayoutSpec(bytes);if(!base)return null;if(!fresh&&cache.has(bytes))return cache.get(bytes);
 const directory=readRomDirectory(bytes),L=worldLayoutContract(bytes,base,directory);
 const a=L.directoryOffset,glyphs=directory?.manifest.resources.place_glyphs;
 if(decoder.decode(span(bytes,a,8))!=='TKWX0001'||u16(bytes,a+8)!==1||u16(bytes,a+10)!==(L.sectorCount??585)||long(bytes,a+24)!==1230||long(bytes,a+20)!==L.codeOffset)fail('INVALID_WEST_CATALOG','西端地图资源目录不匹配');
 const entriesAt=long(bytes,a+12),rows=[],byId=new Map(),byXY=new Map();let previous=-1;
 for(let i=0;i<(L.sectorCount??585);i++){
  const p=entriesAt+i*12,key=long(bytes,p),id=u16(bytes,p+4),flags=u16(bytes,p+6),pointer=long(bytes,p+8),x=(key&65535)-32768,y=Math.floor(key/65536)-32768;
  if(key<=previous||byId.has(id)||byXY.has(`${x},${y}`)||flags!==(id>=1230?2:1))fail('INVALID_WEST_CATALOG','分区编号、顺序或标记异常');previous=key;span(bytes,pointer,64);
  if(L.expectedRows?!(L.expectedRows[i]?.id===id&&L.expectedRows[i].x===x&&L.expectedRows[i].y===y&&L.expectedRows[i].pointer===pointer):id>=1230&&(id>1293||x>=0||x< -8||y<7||y>14))fail('INVALID_WEST_CATALOG','扩展分区超出当前已分配范围');
  const row={id,x,y,pointer};rows.push(row);byId.set(id,row);byXY.set(`${x},${y}`,row);
 }
 if(rows.filter(r=>r.id>=1230).length!==(L.newSectorCount??64))fail('INVALID_WEST_CATALOG','扩展分区数量异常');
 const nav=westNavigation(bytes),values=nav?.values??L.navigation,mutable=new Set(L.relocations.flatMap(r=>Array.from({length:r.width},(_,i)=>r.offset+i)));
 const code=Uint8Array.from(L.codeHex.match(/../g),v=>parseInt(v,16));
 for(const p of L.operandPatches)for(let i=0;i<p.afterBytes.length;i++)if(p.offset+i>=L.codeOffset&&p.offset+i<L.codeOffset+code.length){
  if(code[p.offset+i-L.codeOffset]!==parseInt(p.before.slice(i*2,i*2+2),16))fail('INVALID_WORLD_CONTRACT','地图代码原始操作数不匹配');mutable.add(p.offset+i);
 }
 for(let i=0;i<code.length;i++)if(!mutable.has(L.codeOffset+i)&&bytes[L.codeOffset+i]!==code[i])fail('UNSUPPORTED_WEST_CODE','地图运行代码不匹配',{offset:L.codeOffset+i});
 for(const p of L.relocations){const value=p.width===2?u16(bytes,p.offset):long(bytes,p.offset);if(value!==values[p.field])fail('INVALID_WEST_NAV','寻路常量与目录不一致',{offset:p.offset});}
 const routeSearch=directory?.manifest.resources.route_search;
 const roadFlow=readRoadFlow(bytes,directory);
 for(const patch of [...L.patches,...(L.fixedData??[])]){
  let hex=patch.hex;
  const visit=directory?.manifest.resources.castle_visit_gate;
  if(visit?.schema==='castle-native-visit.v1'&&patch.offset===visit.hook_offset)
   hex='4ef9'+visit.handler_offset.toString(16).padStart(8,'0');
  if(glyphs&&patch.offset===glyphs.hook_offset)hex='4ef9'+glyphs.resolver_offset.toString(16).padStart(8,'0');
  // The weighted A* trial replaces the original FA7C route entry with a JMP
  // to code appended by the build. Trust only the declared, known schema and
  // verify both the bytes and the hook target before accepting the layout.
  if(roadFlow&&patch.offset===0xfa7c){
   hex='4ef9'+roadFlow.entry.toString(16).padStart(8,'0')+patch.hex.slice(12);
  }else if(routeSearch?.schema==='component-weighted-astar.v1'&&patch.offset===routeSearch.hook_offset){
   if(!Number.isInteger(routeSearch.code_offset)||!Number.isInteger(routeSearch.code_bytes)||routeSearch.code_bytes<1||
      routeSearch.code_offset< L.baseLength||routeSearch.code_offset+routeSearch.code_bytes>bytes.length||
      routeSearch.code_offset>0xffffffff||routeSearch.code_bytes>0xffff)
    fail('INVALID_WEST_ROUTE_SEARCH','加权寻路代码范围无效');
   const hook=Uint8Array.from([0x4e,0xf9,(routeSearch.code_offset>>>24)&255,(routeSearch.code_offset>>>16)&255,
    (routeSearch.code_offset>>>8)&255,routeSearch.code_offset&255,0x4e,0x71]);
   const actual=bytes.subarray(patch.offset,patch.offset+hook.length);
   if(actual.length!==hook.length||hook.some((v,i)=>actual[i]!==v))
    fail('UNSUPPORTED_WEST_CODE','加权寻路入口与 ROM 目录不一致',{offset:patch.offset});
   hex=Array.from(hook,v=>v.toString(16).padStart(2,'0')).join('');
  }
  const expected=Uint8Array.from(hex.match(/../g),v=>parseInt(v,16));
  const visitHooks=directory?.manifest.resources.native_visit_hooks;
  if(visitHooks?.schema==='absolute-jump-hooks.v1')for(const [at,target,length] of visitHooks.entries){
   const hook=[0x4e,0xf9,target>>>24,target>>>16&255,target>>>8&255,target&255];while(hook.length<length)hook.push(0x4e,0x71);
   for(let i=Math.max(at,patch.offset);i<Math.min(at+length,patch.offset+expected.length);i++)expected[i-patch.offset]=hook[i-at];
  }
  for(const p of L.operandPatches)for(let i=Math.max(p.offset,patch.offset);i<Math.min(p.offset+p.afterBytes.length,patch.offset+expected.length);i++){
   if(expected[i-patch.offset]!==parseInt(p.before.slice((i-p.offset)*2,(i-p.offset)*2+2),16))fail('INVALID_WORLD_CONTRACT','地图补丁原始操作数不匹配');expected[i-patch.offset]=p.afterBytes[i-p.offset];
  }
  for(let i=0;i<expected.length;i++)if(bytes[patch.offset+i]!==expected[i])fail('UNSUPPORTED_WEST_CODE','地图入口引用不匹配',{offset:patch.offset+i});
 }
 const result={...L,rows,byId,byXY,nav,values,minX:Math.min(...rows.map(r=>r.x))*8,minY:Math.min(...rows.map(r=>r.y))*8,maxX:Math.max(...rows.map(r=>r.x))*8+7,maxY:L.sectorCount?Math.max(...rows.map(r=>r.y))*8+7:191};cache.set(bytes,result);return result;
}

function validateSplitGraph(bytes,L,meta,end){
 let cursor=meta.graphStart,total=0;
 for(const mode of ['land','sailing']){
  const g=meta.components[mode];if(!Number.isInteger(g.edges)||g.edges<0||(meta.version===3?g.nodesAt!==L.fixedBanks[mode].start:g.nodesAt!==cursor))fail('INVALID_WEST_NAV','寻路节点区布局异常');
  const edgesAt=g.nodesAt+g.nodes*8,bankEnd=edgesAt+g.edges*8;if(bankEnd>(meta.version===3?L.fixedBanks[mode].start+L.fixedBanks[mode].capacity:end))fail('INVALID_WEST_NAV','寻路边界目录越界');
  for(let n=0;n<g.nodes;n++){
   const at=g.nodesAt+n*8,owner=u16(bytes,at),degree=u16(bytes,at+2),pointer=long(bytes,at+4);
   if(owner>=L.sectorCount||degree>32||pointer<edgesAt||pointer+degree*8>bankEnd||(pointer-edgesAt)%8)fail('INVALID_WEST_NAV','寻路节点或邻接指针异常');
   for(let k=0;k<degree;k++){const p=pointer+k*8,weight=u16(bytes,p+6);if(u16(bytes,p)>=g.nodes||u16(bytes,p+2)>3||u16(bytes,p+4)<1||u16(bytes,p+4)>255||weight>9)fail('INVALID_WEST_NAV','寻路邻接数据异常');}
  }
  for(let sector=0;sector<L.sectorCount;sector++)for(let cell=0;cell<64;cell++){
   const node=u16(bytes,g.map+sector*128+cell*2);if(node!==65535&&(node>=g.nodes||u16(bytes,g.nodesAt+node*8)!==sector))fail('INVALID_WEST_NAV','寻路图块与节点归属不一致');
  }
  total+=g.nodes*8+g.edges*8;cursor=bankEnd;
 }
 if((meta.version===3?total:cursor-meta.graphStart)!==meta.graphLength)fail('INVALID_WEST_NAV','寻路节点区长度不一致');
}
