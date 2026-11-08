import {WEST_LAYOUT as L,readWestLayout,put} from './west-layout.js';
import {fail} from './codec.js';
const D=[[0,-1],[1,0],[0,1],[-1,0]];
/** Same serialized ABI as rebuild/tools/map_component_graph.py; verified against its ROM bytes. */
export function buildNavigation(bytes,rows,address,spec=L){
 const chunks=[],components={};let length=0;const append=b=>{chunks.push(b);length+=b.length;},coord=new Map(rows.map((r,i)=>[`${r.x},${r.y}`,i]));
 for(const sailing of [false,true]){
  const maps=[],owners=[];
  for(let sector=0;sector<rows.length;sector++){
   const raw=bytes.subarray(rows[sector].pointer,rows[sector].pointer+64),labels=new Uint16Array(64).fill(65535),pass=v=>v>=44||(sailing&&v<=23);
   for(let seed=0;seed<64;seed++){
    if(labels[seed]!==65535||!pass(raw[seed]))continue;
    const node=owners.length;owners.push(sector);labels[seed]=node;const queue=[seed];
    while(queue.length){const c=queue.pop(),x=c%8,y=Math.floor(c/8);for(const [dx,dy]of D){const nx=x+dx,ny=y+dy;if(nx<0||nx>=8||ny<0||ny>=8)continue;const n=ny*8+nx;if(labels[n]===65535&&pass(raw[n])){labels[n]=node;queue.push(n);}}}
   }maps.push(labels);
  }
  if(owners.length>spec.graphCapacity)fail('MAP_NAV_CAPACITY',`地形产生 ${owners.length} 个通行区域，超过当前 ${spec.graphCapacity} 个的寻路容量；请减少碎片或连通孤立区域`);
  const edges=owners.map(()=>new Map());
  for(let sector=0;sector<rows.length;sector++)for(let direction=0;direction<4;direction++){
   const [dx,dy]=D[direction],other=coord.get(`${rows[sector].x+dx},${rows[sector].y+dy}`);if(other===undefined)continue;
   for(let k=0;k<8;k++){
    const [ca,cb]=[[k,56+k],[k*8+7,k*8],[56+k,k],[k*8,k*8+7]][direction],a=maps[sector][ca],b=maps[other][cb];if(a===65535||b===65535)continue;
    const key=b*4+direction;edges[a].set(key,(edges[a].get(key)||0)|(1<<k));
   }
  }
  // Verify the original bounded ring queue for every destination, including disconnected terrain.
  const sortedEdges=edges.map(e=>[...e.keys()].sort((a,b)=>a-b));
  let frontier=0,maxDistance=0;for(let goal=0;goal<owners.length;goal++){
   const visited=new Uint8Array(owners.length),distance=new Uint16Array(owners.length),queue=[goal];visited[goal]=1;let head=0;
   while(head<queue.length){const node=queue[head++];for(const key of sortedEdges[node]){const other=Math.floor(key/4);if(!visited[other]){visited[other]=1;distance[other]=distance[node]+1;maxDistance=Math.max(maxDistance,distance[other]);queue.push(other);}}frontier=Math.max(frontier,queue.length-head);}
  }
  if(frontier>spec.queueCapacity)fail('MAP_NAV_CAPACITY','地形的寻路队列超出游戏容量，请调整碎片布局');
  if(maxDistance>(spec.distanceLimit??65534))fail('MAP_NAV_DISTANCE','当前地形的最远寻路距离超出游戏容量，请缩短绕路或连通区域');
  const map=address+length,mapData=new Uint8Array(rows.length*128);maps.forEach((m,i)=>m.forEach((v,k)=>put(mapData,i*128+k*2,v,2)));append(mapData);
  const nodesAt=address+length,edgeCount=edges.reduce((n,e)=>n+e.size,0),nodesData=new Uint8Array(owners.length*8),edgeData=new Uint8Array(edgeCount*8);let cursor=0;
  edges.forEach((adj,i)=>{put(nodesData,i*8,owners[i],2);put(nodesData,i*8+2,adj.size,2);put(nodesData,i*8+4,nodesAt+nodesData.length+cursor);for(const [key,mask]of [...adj].sort((a,b)=>a[0]-b[0])){put(edgeData,cursor,Math.floor(key/4),2);put(edgeData,cursor+2,key%4,2);put(edgeData,cursor+4,mask,2);cursor+=8;}});
  append(nodesData);append(edgeData);components[sailing?'sailing':'land']={map,nodesAt,nodes:owners.length,edges:edgeCount,maxFrontier:frontier,maxDistance};
 }
 const blob=new Uint8Array(length);let p=0;for(const chunk of chunks){blob.set(chunk,p);p+=chunk.length;}return {blob,components};
}
/** A fast content fingerprint for dirty detection, not an authentication digest. */
export function terrainFingerprint(bytes,rows){let hash=2166136261;for(const r of rows)for(let i=0;i<64;i++)hash=Math.imul(hash^bytes[r.pointer+i],16777619)>>>0;return hash;}
export function worldNavigationDirty(bytes){const l=readWestLayout(bytes);if(!l)return false;const expected=l.nav?.terrainFingerprint??l.terrainFingerprint;return expected===undefined||terrainFingerprint(bytes,l.rows)!==expected;}
export function rebuildWestNavigation(bytes){
 const layout=readWestLayout(bytes);if(!layout)return bytes;
 const L=layout;
 if(L.navigationStorage==='fixed-capacity-banks')return rebuildFixedNavigation(bytes,L);
 if(L.navigationStorage==='original-maps-appended-banks')return rebuildSplitNavigation(bytes,L);
 const start=layout.nav?.start??bytes.length,size=L.navSlotSize,end=start+size;
 if(Math.max(bytes.length,end)>L.romLimit)fail('MAP_NAV_CAPACITY','没有足够的已验证 ROM 空间保存寻路资源');
 const graphStart=start+4096,{blob,components}=buildNavigation(bytes,layout.rows,graphStart);
 if(blob.length>size-4096-16)fail('MAP_NAV_CAPACITY','当前地形寻路资源超过编辑区容量，请减少孤立碎片');
 const out=new Uint8Array(Math.max(bytes.length,end));out.set(bytes);out.fill(0,start,end);out.set(new TextEncoder().encode('TKWNAVD1'),start);
 const meta={version:1,graphStart,graphLength:blob.length,components,terrainFingerprint:terrainFingerprint(bytes,layout.rows)};const encoded=new TextEncoder().encode(JSON.stringify(meta));out.set(encoded,start+16);out.set(blob,graphStart);out.set(new TextEncoder().encode('TKWNAV01'),end-16);put(out,end-8,start);put(out,end-4,size);
 const values={LAND_MAP:components.land.map,LAND_NODES:components.land.nodesAt,LAND_COUNT:components.land.nodes,SAILING_MAP:components.sailing.map,SAILING_NODES:components.sailing.nodesAt,SAILING_COUNT:components.sailing.nodes};
 for(const r of L.relocations)put(out,r.offset,values[r.field],r.width);put(out,0x1a4,out.length-1);
 readWestLayout(out);return out;
}

/** V26: retain both fixed cell maps, relocate variable node/edge banks only. */
function rebuildSplitNavigation(bytes,L){
 const start=L.nav?.start??bytes.length,size=L.navSlotSize,end=start+size,graphStart=start+4096;
 if(Math.max(bytes.length,end)>L.romLimit)fail('MAP_NAV_CAPACITY','没有足够的已验证 ROM 空间保存寻路资源');
 const built=buildNavigation(bytes,L.rows,0,L),components={},banks=[];let cursor=0;
 for(const mode of ['land','sailing']){
  const g=built.components[mode],nodesAt=graphStart+cursor,bank=built.blob.slice(g.nodesAt,g.nodesAt+g.nodes*8+g.edges*8),delta=nodesAt-g.nodesAt;
  for(let n=0;n<g.nodes;n++){const at=n*8+4,ptr=(bank[at]*16777216+bank[at+1]*65536+bank[at+2]*256+bank[at+3]);put(bank,at,ptr+delta);}
  components[mode]={...g,map:L.navigation[mode.toUpperCase()+'_MAP'],nodesAt};banks.push(bank);cursor+=bank.length;
 }
 if(cursor>size-4096-16)fail('MAP_NAV_CAPACITY','当前地形寻路节点超过编辑区容量，请减少孤立碎片或撤销修改');
 const out=new Uint8Array(Math.max(bytes.length,end));out.set(bytes);out.fill(0,start,end);
 out.set(new TextEncoder().encode('TKWNAVD2'),start);
 const meta={version:2,graphStart,graphLength:cursor,components,terrainFingerprint:terrainFingerprint(bytes,L.rows)},encoded=new TextEncoder().encode(JSON.stringify(meta));if(encoded.length>4080)fail('MAP_NAV_CAPACITY','寻路资源目录超过容量');out.set(encoded,start+16);
 cursor=graphStart;for(const bank of banks){out.set(bank,cursor);cursor+=bank.length;}
 for(const mode of ['land','sailing']){const g=built.components[mode];out.set(built.blob.subarray(g.map,g.map+L.rows.length*128),components[mode].map);}
 out.set(new TextEncoder().encode('TKWNAV01'),end-16);put(out,end-8,start);put(out,end-4,size);
 const values={LAND_MAP:components.land.map,LAND_NODES:components.land.nodesAt,LAND_COUNT:components.land.nodes,SAILING_MAP:components.sailing.map,SAILING_NODES:components.sailing.nodesAt,SAILING_COUNT:components.sailing.nodes};for(const r of L.relocations)put(out,r.offset,values[r.field],r.width);put(out,0x1a4,out.length-1);readWestLayout(out);return out;
}

/** V28 reuses owned node/edge banks with explicit spare capacity; metadata alone is appended. */
function rebuildFixedNavigation(bytes,L){
 const start=L.nav?.start??bytes.length,size=L.navSlotSize,end=start+size;
 if(Math.max(bytes.length,end)>L.romLimit)fail('MAP_NAV_CAPACITY','没有足够空间保存寻路目录');
 const built=buildNavigation(bytes,L.rows,0,L),out=new Uint8Array(Math.max(bytes.length,end));out.set(bytes);out.fill(0,start,end);const components={};let graphLength=0;
 for(const mode of ['land','sailing']){
  const g=built.components[mode],slot=L.fixedBanks[mode],bank=built.blob.slice(g.nodesAt,g.nodesAt+g.nodes*8+g.edges*8);
  if(bank.length>slot.capacity)fail('MAP_NAV_CAPACITY','当前地形碎片超过预留寻路容量，请连通碎片或撤销本次修改');
  const delta=slot.start-g.nodesAt;for(let n=0;n<g.nodes;n++){const at=n*8+4,pointer=bank[at]*16777216+bank[at+1]*65536+bank[at+2]*256+bank[at+3];put(bank,at,pointer+delta);}
  const map=L.navigation[mode.toUpperCase()+'_MAP'];out.set(built.blob.subarray(g.map,g.map+L.rows.length*128),map);out.fill(0,slot.start,slot.start+slot.capacity);out.set(bank,slot.start);components[mode]={...g,map,nodesAt:slot.start};graphLength+=bank.length;
 }
 const meta={version:3,graphStart:0,graphLength,components,terrainFingerprint:terrainFingerprint(bytes,L.rows)},encoded=new TextEncoder().encode(JSON.stringify(meta));if(encoded.length>4080)fail('MAP_NAV_CAPACITY','寻路资源目录超过容量');
 out.set(new TextEncoder().encode('TKWNAVD3'),start);out.set(encoded,start+16);out.set(new TextEncoder().encode('TKWNAV01'),end-16);put(out,end-8,start);put(out,end-4,size);
 const values={LAND_MAP:components.land.map,LAND_NODES:components.land.nodesAt,LAND_COUNT:components.land.nodes,SAILING_MAP:components.sailing.map,SAILING_NODES:components.sailing.nodesAt,SAILING_COUNT:components.sailing.nodes};for(const r of L.relocations)put(out,r.offset,values[r.field],r.width);put(out,0x1a4,out.length-1);readWestLayout(out);return out;
}
