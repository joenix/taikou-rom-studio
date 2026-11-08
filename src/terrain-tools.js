export function rasterLine(a,b){let {x,y}=a;const out=[],dx=Math.abs(b.x-x),dy=Math.abs(b.y-y),sx=x<b.x?1:-1,sy=y<b.y?1:-1;let e=dx-dy;for(;;){out.push({x,y});if(x===b.x&&y===b.y)break;const v=2*e;if(v>-dy){e-=dy;x+=sx;}if(v<dx){e+=dx;y+=sy;}}return out;}
export function mapCell(map,x,y){if(x<map.minX||x>map.maxX||y<map.minY||y>map.maxY)return -1;return map.cells[(y-map.minY)*map.width+x-map.minX];}
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
