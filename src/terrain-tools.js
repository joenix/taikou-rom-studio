export function rasterLine(a,b){let {x,y}=a;const out=[],dx=Math.abs(b.x-x),dy=Math.abs(b.y-y),sx=x<b.x?1:-1,sy=y<b.y?1:-1;let e=dx-dy;for(;;){out.push({x,y});if(x===b.x&&y===b.y)break;const v=2*e;if(v>-dy){e-=dy;x+=sx;}if(v<dx){e+=dx;y+=sy;}}return out;}
/** Grid-traversal line with only orthogonal steps, for ROM paths that cannot join diagonally. */
export function rasterOrthogonalLine(a,b){
 let x=a.x,y=a.y;const out=[{x,y}],dx=Math.abs(b.x-x),dy=Math.abs(b.y-y),sx=x<b.x?1:-1,sy=y<b.y?1:-1;let ix=0,iy=0;
 while(ix<dx||iy<dy){
  if(ix>=dx){y+=sy;iy++;}
  else if(iy>=dy){x+=sx;ix++;}
  else if((ix+0.5)/dx<=(iy+0.5)/dy){x+=sx;ix++;}
  else{y+=sy;iy++;}
  out.push({x,y});
 }
 return out;
}
export function mapCell(map,x,y){if(x<map.minX||x>map.maxX||y<map.minY||y>map.maxY)return -1;return map.cells[(y-map.minY)*map.width+x-map.minX];}
const DIRS=[{dx:0,dy:-1,bit:1},{dx:1,dy:0,bit:2},{dx:0,dy:1,bit:4},{dx:-1,dy:0,bit:8}];
const RIVER_NETWORK=new Set([0,1,2,3,4,5,6,7,8,9,10,24,63]);
const ROAD_NETWORK=new Set([44,45,46,47,48,49,50,51,52,63]);
function lineTile(feature,mask){
 if(feature==='river'){
  if(mask===5||mask===1||mask===4)return 0; if(mask===10||mask===2||mask===8)return 1;
  if(mask===6)return 2; if(mask===12)return 3; if(mask===3)return 4; if(mask===9)return 5;
  if(mask===0)return 0;
  return null;
 }
 if(mask===5||mask===1||mask===4)return 46; if(mask===10||mask===2||mask===8)return 47;
 if(mask===6)return 48; if(mask===12)return 49; if(mask===3)return 50; if(mask===9)return 51;
 if(mask===11)return 52;
 if(mask===0)return 46;
 return null;
}
/** Convert a semantic stroke to the game's original terrain IDs; unsupported joins are reported for hand repair. */
export function autoTileStroke(map,stroke,feature){
 if(feature!=='river'&&feature!=='road')throw new Error('不支持的自动拼接类型');
 const network=feature==='river'?RIVER_NETWORK:ROAD_NETWORK,drawn=new Map();
 for(const p of stroke)drawn.set(`${p.x},${p.y}`,{x:p.x,y:p.y});
 const all=new Set(),baseRivers=new Set(),baseRoads=new Set();
 for(let y=map.minY;y<=map.maxY;y++)for(let x=map.minX;x<=map.maxX;x++){
  const code=mapCell(map,x,y),key=`${x},${y}`;
  if(RIVER_NETWORK.has(code))baseRivers.add(key);if(ROAD_NETWORK.has(code))baseRoads.add(key);
  if(network.has(code))all.add(key);
 }
 for(const key of drawn.keys())all.add(key);
 const targets=new Map(drawn);for(const key of drawn.keys()){const p=drawn.get(key);for(const d of DIRS){const k=`${p.x+d.dx},${p.y+d.dy}`;if(all.has(k))targets.set(k,{x:p.x+d.dx,y:p.y+d.dy});}}
 const cells=[],warnings=new Set();
 for(const [key,p] of targets){
  const before=mapCell(map,p.x,p.y);
  if(before<0||before>=64){warnings.add('城、町入口和未分配区域已跳过');continue;}
  if(before===63){warnings.add('原版桥梁已保留');continue;}
  if(feature==='river'&&[7,8,9,10,24].includes(before)){warnings.add('原版河源／河口图块已保留，请检查连接');continue;}
  if(feature==='road'&&[44,45,52].includes(before)){warnings.add('原版岔路图块已保留');continue;}
  if(feature==='road'&&((before>=25&&before<=43)||(before>=60&&before<=62))){warnings.add('道路穿过山体的位置已跳过，请绕行或手动处理');continue;}
  if(feature==='river'&&((before>=25&&before<=43)||(before>=60&&before<=62))){warnings.add('河流穿过山体的位置已跳过，请调整走向');continue;}
  let mask=0;for(const d of DIRS)if(all.has(`${p.x+d.dx},${p.y+d.dy}`))mask|=d.bit;
  const other=feature==='road'?baseRivers:baseRoads;
  let otherMask=0;for(const d of DIRS)if(other.has(`${p.x+d.dx},${p.y+d.dy}`))otherMask|=d.bit;
  const ownAxis=mask,otherAxis=otherMask;
  const crossing=(feature==='road'&&before>=0&&before<=6)||(feature==='river'&&before>=44&&before<=52);
  if(crossing){
   const bridge=feature==='road'?(ownAxis===10&&(otherAxis&5)===5):(ownAxis===5&&otherAxis===10);
   if(bridge){cells.push({x:p.x,y:p.y,code:63});continue;}
   warnings.add('此处道路与河流交叉方向没有对应原版桥图块，已留待手工处理');continue;
  }
  if(feature==='road'&&((before>=0&&before<=24)||before===24)){warnings.add('道路遇到河流／海岸已停止自动覆盖，请使用桥梁或调整路线');continue;}
  if(feature==='river'&&before>=11&&before<=23)continue;
  const tile=lineTile(feature,mask);
  if(tile===null){warnings.add(feature==='river'?'河流分叉暂需手工修整':'道路交叉或该朝向的岔路暂需手工修整');continue;}
  if(before!==tile)cells.push({x:p.x,y:p.y,code:tile});
  if(feature==='river'&&mask!==0&&((mask&(mask-1))===0)){
   const seaSide=mask===1?4:mask===2?8:mask===4?1:2;
   const sea=DIRS.find(d=>d.bit===seaSide);if(sea&&mapCell(map,p.x+sea.dx,p.y+sea.dy)===19)warnings.add('河口位置请检查；必要时手动选用原版河口图块');
  }
 }
 if(!cells.length&&warnings.size)warnings.add('没有可自动拼接的地图格');
 return {cells,warnings:[...warnings]};
}
export function samplePattern(map,a,b){const x0=Math.min(a.x,b.x),y0=Math.min(a.y,b.y),w=Math.abs(a.x-b.x)+1,h=Math.abs(a.y-b.y)+1;if(w>16||h>16)throw new Error('组合取样最多16×16格');const cells=[];for(let y=0;y<h;y++)for(let x=0;x<w;x++){const code=mapCell(map,x0+x,y0+y);if(code<0||code>=64)throw new Error('取样请避开城、町和未分配区域');cells.push({x,y,code});}return {name:`取样 ${w}×${h}`,width:w,height:h,cells};}
export function mountainPatterns(map){
 const body=new Map();for(let y=map.minY;y<=map.maxY;y++)for(let x=map.minX;x<=map.maxX;x++){const v=mapCell(map,x,y);if(v>=25&&v<=43)body.set(`${x},${y}`,{x,y,code:v});}
 const out=[],seen=new Set();
 // Prefer complete new-region assemblies before original-world examples.
 const seeds=[...body.values()].sort((a,b)=>(a.x<0?0:1)-(b.x<0?0:1)||a.y-b.y||a.x-b.x);
 for(const seed of seeds){if(!body.has(`${seed.x},${seed.y}`))continue;const cells=[seed];body.delete(`${seed.x},${seed.y}`);
  for(const p of cells)for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){const key=`${p.x+dx},${p.y+dy}`,q=body.get(key);if(q){cells.push(q);body.delete(key);}}
  const feet=[];for(const p of cells){const code=mapCell(map,p.x,p.y+1);if(code>=60&&code<=62)feet.push({x:p.x,y:p.y+1,code});}cells.push(...feet);
  const x0=Math.min(...cells.map(p=>p.x)),y0=Math.min(...cells.map(p=>p.y)),width=Math.max(...cells.map(p=>p.x))-x0+1,height=Math.max(...cells.map(p=>p.y))-y0+1;if(width>12||height>12||cells.length<4)continue;
  const relative=cells.map(p=>({x:p.x-x0,y:p.y-y0,code:p.code})),key=JSON.stringify(relative);if(seen.has(key))continue;seen.add(key);out.push({name:`山体 ${out.length+1}`,width,height,cells:relative});if(out.length>=36)break;
 }return out;
}
export const BASIC_PATTERNS=[{name:'河源 · 向南',width:3,height:3,cells:[[53,53,53],[24,3,53],[53,0,53]].flatMap((r,y)=>r.map((code,x)=>({x,y,code})))},{name:'桥 · 横路竖河',width:3,height:3,cells:[[53,0,53],[47,63,47],[53,0,53]].flatMap((r,y)=>r.map((code,x)=>({x,y,code})))}];
export function terrainName(code){if(code<0)return '未分配区域';if(code>=128)return '城门';if(code>=64)return '町入口';if(code===24)return '河源 · 向东出水';if(code===63)return '桥 · 横路竖河';if(code===53)return '普通地面';if(code>=60)return '山脚／阴影 · 配套使用';if(code>=55)return '树林';if(code===54)return '田地';if(code>=44)return ({44:'道路 · 岔口',45:'道路 · 岔口',46:'道路 · 竖向',47:'道路 · 横向',48:'道路 · 转角',49:'道路 · 转角',50:'道路 · 转角',51:'道路 · 转角',52:'道路 · 岔口'})[code];if(code>=25)return '山体片 · 建议使用组合';if(code>=11)return code===19?'海面':'海岸';if(code>=7)return '河口 · 配套使用';if(code<=1)return code===0?'河道 · 竖向':'河道 · 横向';return '河道 · 弯道／分流';}
