// Port of taikou-rebuild/tools/road_flow_fields.cpp. Same tuple ordering and
// two-bit directions; only terrain is editable, destination order stays fixed.
import {readRoadFlow} from './road-flow.js';
import {readWestMap} from './west-map.js';
import {readWestLayout,put,long} from './west-layout.js';
import {readRomDirectory,appendRomDirectory} from './rom-directory.js';
import {fail,u16} from './codec.js';
const KEYS=['RF_ATLAS','RF_PAGES','RF_ROOTS','RF_GROUP_ATLAS','RF_GROUP_INDEX','RF_ID_ROWS','RF_NEIGHBORS','RF_GOALS'];
const BASE=1048576;
class Heap{
 constructor(){this.cost=[];this.steps=[];this.pos=[];this.length=0;}
 less(c,s,p,i){return c<this.cost[i]||c===this.cost[i]&&(s<this.steps[i]||s===this.steps[i]&&p<this.pos[i]);}
 set(i,c,s,p){this.cost[i]=c;this.steps[i]=s;this.pos[i]=p;}
 push(c,s,p){let i=this.length++;while(i){const parent=(i-1)>>1;if(!this.less(c,s,p,parent))break;this.set(i,this.cost[parent],this.steps[parent],this.pos[parent]);i=parent;}this.set(i,c,s,p);}
 pop(){this.c=this.cost[0];this.s=this.steps[0];this.p=this.pos[0];const n=--this.length;if(!n)return;const c=this.cost[n],s=this.steps[n],p=this.pos[n];let i=0;while(i*2+1<n){let k=i*2+1;if(k+1<n&&this.less(this.cost[k+1],this.steps[k+1],this.pos[k+1],k))k++;if(!this.less(this.cost[k],this.steps[k],this.pos[k],n))break;this.set(i,this.cost[k],this.steps[k],this.pos[k]);i=k;}this.set(i,c,s,p);}
}
function key(bytes){let out='';for(const b of bytes)out+=String.fromCharCode(b);return out;}
function dictionary(){const ids=new Map(),blocks=[];return {blocks,add(b){const k=key(b);if(ids.has(k))return ids.get(k);if(blocks.length>=65535)fail('MAP_NAV_CAPACITY','寻路图块种类超过容量，请减少地形碎片');const id=blocks.length;ids.set(k,id);blocks.push(new Uint8Array(b));return id;}};}
const join=blocks=>{const b=new Uint8Array(blocks.reduce((n,v)=>n+v.length,0));let p=0;for(const v of blocks){b.set(v,p);p+=v.length;}return b;};
const words=values=>{const b=new Uint8Array(values.length*2);values.forEach((v,i)=>{b[i*2]=v>>>8;b[i*2+1]=v&255;});return b;};
export function buildRoadFlowTables(bytes,progress=()=>{}){
 const r=readRoadFlow(bytes);if(!r||r.policy!=='lexicographic-roads-first-v2')fail('UNSUPPORTED_ROAD_BUILD','此版本的寻路编译格式尚未支持');
 const map=readWestMap(bytes),layout=readWestLayout(bytes),rows=layout.rows,w=map.width,h=map.height,size=w*h,raw=map.cells,n=rows.length;
 if(size*2>=BASE||n!==r.sector_count)fail('UNSUPPORTED_ROAD_BUILD','地图超出寻路编译范围');
 const pass=(p,mode)=>raw[p]>=44||mode&&raw[p]>=0&&raw[p]<=23;
 const adjacent=(p,d)=>d===0?(p<w?-1:p-w):d===1?(p%w===w-1?-1:p+1):d===2?(p>=w*(h-1)?-1:p+w):(p%w===0?-1:p-1);
 const road=new Uint8Array(size);for(let p=0;p<size;p++)road[p]=raw[p]>=44&&raw[p]<=52?1:0;
 const groups=[],queue=new Int32Array(size),counts=[];
 for(let mode=0;mode<2;mode++){
  const g=new Uint16Array(size);g.fill(65535);let count=0;
  for(let p=0;p<size;p++)if(pass(p,mode)&&g[p]===65535){if(count>=255)fail('MAP_NAV_CAPACITY','孤立地形区域超过255个，请连通部分地形');let head=0,tail=1;queue[0]=p;g[p]=count;while(head<tail){const at=queue[head++];for(let d=0;d<4;d++){const q=adjacent(at,d);if(q>=0&&pass(q,mode)&&g[q]===65535){g[q]=count;queue[tail++]=q;}}}count++;}groups.push(g);counts.push(count);
 }
 // At most 254 land components: a simple optimal route crosses fewer than
 // 508 shores. Packed costs stay below 2^50, exactly representable by Number.
 const patterns=dictionary(),indexes=[],metrics=[];patterns.add(new Uint8Array(16));
 const goals=[];
 for(let goal=0;goal<r.goal_count;goal++){
  const at=r.symbols.RF_GOALS+goal*8,row=layout.byId.get(u16(bytes,at));if(!row)fail('INVALID_ROAD_FLOW','寻路终点分区缺失');
  const x=row.x*8+bytes[at+2]-map.minX,y=row.y*8+bytes[at+3]-map.minY,g=y*w+x;
  if(x<0||y<0||x>=w||y>=h||!pass(g,0))fail('PROTECTED_LOCATION_CELL','城池或町入口不能被不可行走地形覆盖');goals.push({g,record:bytes.slice(at,at+8)});
  let landDist,landSteps,landDir;
  for(let mode=0;mode<2;mode++){
   const dist=new Float64Array(size);dist.fill(Infinity);const steps=new Uint32Array(size);steps.fill(0x3fffffff);const dirs=new Uint8Array(size),heap=new Heap();
   if(!mode){dist[g]=0;steps[g]=0;heap.push(0,0,g);}else for(let p=0;p<size;p++)if(Number.isFinite(landDist[p])){dist[p]=landDist[p];steps[p]=landSteps[p];dirs[p]=landDir[p];heap.push(dist[p],steps[p],p);}
   while(heap.length){heap.pop();const cost=heap.c,len=heap.s,p=heap.p;if(cost!==dist[p]||len!==steps[p])continue;
    for(let d=0;d<4;d++){const q=adjacent(p,d);if(q<0||!pass(q,mode)||mode&&groups[0][q]===groups[0][g])continue;
     const edge=(2-road[p]-road[q])*BASE+1+(mode&&((raw[p]<24)!==(raw[q]<24))?BASE*BASE:0),next=cost+edge,ns=len+1;
     if(next<dist[q]||next===dist[q]&&ns<steps[q]){dist[q]=next;steps[q]=ns;dirs[q]=(d+2)%4;heap.push(next,ns,q);}
    }
   }
   let checked=0;for(let p=0;p<size;p++)if(Number.isFinite(dist[p])&&p!==g){const q=adjacent(p,dirs[p]),edge=q<0?Infinity:(2-road[p]-road[q])*BASE+1+(mode&&((raw[p]<24)!==(raw[q]<24))?BASE*BASE:0);if(q<0||!pass(q,mode)||dist[q]>=dist[p]||dist[q]+edge!==dist[p]||steps[q]+1!==steps[p])fail('INVALID_ROAD_BUILD','寻路校验未通过，未生成导出文件');checked++;}metrics.push(checked);
   for(const row of rows){const block=new Uint8Array(16);for(let yy=0;yy<8;yy++)for(let xx=0;xx<8;xx++){const k=yy*8+xx,p=(row.y*8-map.minY+yy)*w+row.x*8-map.minX+xx;block[k>>2]|=dirs[p]<<(6-2*(k%4));}indexes.push(patterns.add(block));}
   if(!mode){landDist=dist;landSteps=steps;landDir=dirs;}
  }
  progress({done:goal+1,total:r.goal_count});
 }
 const pages=dictionary(),roots=[];for(let f=0;f<r.goal_count*2;f++)for(let p=0;p<n;p+=32){const ids=Array.from({length:32},(_,i)=>p+i<n?indexes[f*n+p+i]:0);roots.push(pages.add(words(ids)));}
 const groupAtlas=dictionary(),groupIndex=[];
 for(const row of rows){const block=new Uint8Array(128);for(let y=0;y<8;y++)for(let x=0;x<8;x++){const p=(row.y*8-map.minY+y)*w+row.x*8-map.minX+x,k=(y*8+x)*2;block[k]=groups[0][p]===65535?255:groups[0][p];block[k+1]=groups[1][p]===65535?255:groups[1][p];}groupIndex.push(groupAtlas.add(block));}
 const records=join(goals.map(({g,record})=>{record[4]=groups[0][g];record[5]=groups[1][g];return record;}));
 const parts=[join(patterns.blocks),join(pages.blocks),words(roots),join(groupAtlas.blocks),words(groupIndex),bytes.slice(r.symbols.RF_ID_ROWS,r.symbols.RF_NEIGHBORS),bytes.slice(r.symbols.RF_NEIGHBORS,r.symbols.RF_GOALS),records];
 return {keys:KEYS,parts,metrics,counts};
}
export function installRoadFlowTables(bytes,built){
 const directory=readRomDirectory(bytes),r=readRoadFlow(bytes),manifest=structuredClone(directory.manifest),symbols=manifest.resources.road_flow.symbols;
 const size=built.parts.reduce((sum,v)=>sum+v.length,0),start=r.editor_tables?.offset??directory.payloadOffset;
 const capacity=r.editor_tables?.capacity??0xa0000;if(size>capacity)fail('MAP_NAV_CAPACITY','寻路资源超过预留容量，请减少地形碎片');
 const payloadEnd=r.editor_tables?directory.payloadOffset:start+capacity;
 const out=new Uint8Array(payloadEnd);out.set(bytes.subarray(0,directory.payloadOffset));out.fill(0,start,start+capacity);let cursor=start;
 for(let i=0;i<KEYS.length;i++){symbols[KEYS[i]]=cursor;out.set(built.parts[i],cursor);cursor+=built.parts[i].length;}
 const hits=Object.fromEntries(KEYS.map(k=>[k,0]));
 // Only known LEA absolute-long operands in the owned runtime block are relocated.
 for(let p=r.code_offset;p<r.code_offset+r.code_bytes-5;p+=2){const op=u16(bytes,p);if((op&0xf1ff)!==0x41f9)continue;const value=long(bytes,p+2),k=KEYS.find(k=>r.symbols[k]===value);if(k){put(out,p+2,symbols[k]);hits[k]++;}}
 if(Object.values(hits).some(n=>n===0)||Object.values(hits).reduce((a,b)=>a+b,0)!==13)fail('UNSUPPORTED_ROAD_BUILD','寻路代码引用不匹配，未生成导出文件');
 manifest.resources.road_flow.editor_tables={schema:'world.road-flow-tables.v1',offset:start,length:size,capacity};
 manifest.resources.road_flow.editor_build={algorithm:'road_flow_fields.cpp.v1',terrain_fingerprint:readWestLayout(bytes).nav.terrainFingerprint,validated_edges:built.metrics.reduce((a,b)=>a+b,0)};
 return appendRomDirectory(out,manifest);
}
