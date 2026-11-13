import {useEffect,useMemo,useRef,useState} from 'react';
import {Hand,Paintbrush,Pipette,Scan,Copy,Undo2,Redo2,RotateCcw,Grid2X2,X} from 'lucide-react';
import {readOverview,overviewTiles,OVERVIEW_COLORS} from './rom/overview.js';
import {useMapPan} from './map-pan.js';
import {mobileViewer} from './edit-access.js';
import {rasterLine} from './terrain-tools.js';

function Tile({pixels,palette}){
 const ref=useRef(null);
 useEffect(()=>{const c=ref.current;c.width=c.height=8;const ctx=c.getContext('2d'),im=ctx.createImageData(8,8);pixels.forEach((v,i)=>im.data.set([...palette[v],255],i*4));ctx.putImageData(im,0,0);},[pixels,palette]);
 return <canvas ref={ref} aria-hidden="true"/>;
}
const NAMES={0:'透明底色',1:'浅色点阵',2:'深海',3:'深色水纹',4:'陆地',5:'岸线褐色',6:'点阵',7:'阴影',8:'浅色水纹',10:'海水'};
const bounds=(a,b)=>({x0:Math.min(a.x,b.x),y0:Math.min(a.y,b.y),x1:Math.max(a.x,b.x),y1:Math.max(a.y,b.y)});
export default function OverviewEditor(props){
 const cap=props.doc.overviewCapability;
 if(!cap.supported)return <div className="overview-unavailable"><strong>势力图绘制</strong><p>{cap.error.message}</p><p>导入配套新版 ROM 后即可使用，原文件不会被覆盖。</p></div>;
 return <PaintOverview {...props}/>;
}
function PaintOverview({doc,revision,mode,onChange}){
 const model=useMemo(()=>doc.overviewSnapshot(),[doc,revision]);
 const baseline=useMemo(()=>readOverview(doc.importedBytes),[doc]);
 const editable=mode==='edit'&&!mobileViewer(),canvas=useRef(null),overlay=useRef(null),view=useRef(null),gesture=useRef(null);
 const [tool,setTool]=useState('pan'),[zoom,setZoom]=useState(()=>mobileViewer()?2:4),[color,setColor]=useState(4),[size,setSize]=useState(1),[grid,setGrid]=useState(false),[hover,setHover]=useState(null),[selection,setSelection]=useState(null),[stamp,setStamp]=useState(null),[group,setGroup]=useState('land'),[limit,setLimit]=useState(48),[compare,setCompare]=useState(false),[error,setError]=useState(''),[tick,setTick]=useState(0);
 useMapPan(view,tool==='pan'||!editable,doc);
 useEffect(()=>{gesture.current=null;setTick(n=>n+1);if(!editable)setTool('pan');},[editable,revision]);
 const tiles=useMemo(()=>overviewTiles(model,group),[model,group]);
 useEffect(()=>{
  const c=canvas.current;c.width=640;c.height=224;const ctx=c.getContext('2d'),im=ctx.createImageData(640,224),pixels=(compare?baseline:model).pixels.slice();
  if(!compare)for(const p of gesture.current?.cells?.values()||[])pixels[p.y*640+p.x]=p.color;
  pixels.forEach((v,i)=>im.data.set([...model.palette[v],255],i*4));ctx.putImageData(im,0,0);
  const o=overlay.current;o.width=640*zoom;o.height=224*zoom;const g=o.getContext('2d');g.fillStyle='#33333318';g.fillRect(128*zoom,0,512*zoom,224*zoom);
  g.strokeStyle='#a55732';g.setLineDash([5,4]);g.beginPath();g.moveTo(128*zoom,0);g.lineTo(128*zoom,o.height);g.stroke();g.setLineDash([]);
  if(grid){const step=(zoom>=12?1:8)*zoom;g.strokeStyle='#00000020';for(let x=0;x<=o.width;x+=step){g.beginPath();g.moveTo(x+.5,0);g.lineTo(x+.5,o.height);g.stroke();}for(let y=0;y<=o.height;y+=step){g.beginPath();g.moveTo(0,y+.5);g.lineTo(o.width,y+.5);g.stroke();}}
  const s=gesture.current?.selection||selection;if(s){g.strokeStyle='#a04430';g.lineWidth=2;g.strokeRect(s.x0*zoom+.5,s.y0*zoom+.5,(s.x1-s.x0+1)*zoom,(s.y1-s.y0+1)*zoom);}
 },[model,baseline,zoom,grid,selection,compare,tick]);
 function point(e){const r=canvas.current.getBoundingClientRect();return {x:Math.floor((e.clientX-r.left)/zoom),y:Math.floor((e.clientY-r.top)/zoom)};}
 function pickup(p){if(p.x<0||p.x>=640||p.y<0||p.y>=224)return;const v=model.pixels[p.y*640+p.x];if(OVERVIEW_COLORS.includes(v)){setColor(v);setStamp(null);setTool('brush');}else setError('城点与道路颜色保持保护，请吸取底图颜色');}
 function add(g,p){
  const w=stamp?.width||size,h=stamp?.height||size,x=stamp?Math.floor(p.x/8)*8:p.x,y=stamp?Math.floor(p.y/8)*8:p.y;
  for(let dy=0;dy<h;dy++)for(let dx=0;dx<w;dx++){const xx=x+dx,yy=y+dy,v=stamp?stamp.pixels[dy*w+dx]:color;if(OVERVIEW_COLORS.includes(v)&&!model.protectedPixel(xx,yy))g.cells.set(yy*128+xx,{x:xx,y:yy,color:v});}
 }
 function commit(cells,rev=revision){try{if(cells.length&&doc.applyOverview(cells,rev))onChange();setError('');}catch(e){setError(e.message);}}
 function fill(p){
  if(model.protectedPixel(p.x,p.y))return;const value=model.pixels[p.y*640+p.x],seen=new Set([p.y*640+p.x]),q=[p],cells=[];
  for(const a of q){cells.push({...a,color});for(const b of [{x:a.x-1,y:a.y},{x:a.x+1,y:a.y},{x:a.x,y:a.y-1},{x:a.x,y:a.y+1}]){const i=b.y*640+b.x;if(!model.protectedPixel(b.x,b.y)&&!seen.has(i)&&model.pixels[i]===value){seen.add(i);q.push(b);}}}commit(cells);
 }
 function down(e){
  if(!editable||tool==='pan'||compare)return;view.current.focus({preventScroll:true});const p=point(e);setError('');
  if(e.button===2||tool==='pick'){e.preventDefault();pickup(p);return;}if(e.button!==0)return;
  if(tool==='fill'){fill(p);return;}
  if(p.x<0||p.x>=640||p.y<0||p.y>=224)return;
  e.currentTarget.setPointerCapture(e.pointerId);gesture.current={id:e.pointerId,start:p,last:p,cells:new Map(),revision};
  if(tool==='brush')add(gesture.current,p);else gesture.current.selection=bounds(p,p);setTick(n=>n+1);
 }
 function move(e){const p=point(e);setHover(p);const g=gesture.current;if(!g||g.id!==e.pointerId)return;
  if(tool==='brush')for(const q of rasterLine(g.last,p))add(g,q);else g.selection=bounds(g.start,{x:Math.max(0,Math.min(639,p.x)),y:Math.max(0,Math.min(223,p.y))});g.last=p;setTick(n=>n+1);
 }
 function up(){const g=gesture.current;if(!g)return;gesture.current=null;
  if(tool==='brush')commit([...g.cells.values()],g.revision);
  else if(tool==='copy'){
   const r=g.selection,w=r.x1-r.x0+1,h=r.y1-r.y0+1;
   if(w>32||h>32)setError('组合取样最大为32×32像素，请缩小选区');
   else{setStamp({width:w,height:h,pixels:Array.from({length:w*h},(_,i)=>{const v=model.pixels[(r.y0+Math.floor(i/w))*640+r.x0+i%w];return OVERVIEW_COLORS.includes(v)?v:null;})});setTool('brush');setSelection(null);}
  }else setSelection(g.selection);setTick(n=>n+1);
 }
 function restore(){if(!selection)return;try{if(doc.restoreOverview(selection))onChange();setError('');}catch(e){setError(e.message);}}
 function fillSelection(){if(!selection)return;const cells=[];for(let y=selection.y0;y<=selection.y1;y++)for(let x=selection.x0;x<=selection.x1;x++)if(!model.protectedPixel(x,y))cells.push({x,y,color});commit(cells);}
 function key(e){if(!editable)return;if(e.key==='Escape'){gesture.current=null;setSelection(null);setTick(n=>n+1);}if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='z'){e.preventDefault();gesture.current=null;e.shiftKey?doc.redo():doc.undo();onChange();}}
 const tools=[['pan','拖动',Hand],['brush','画笔',Paintbrush],['pick','吸色',Pipette],['rect','选区',Scan],['copy','组合取样',Copy]];
 return <section className="overview-editor" aria-label="势力图绘制">
  <div className="overview-toolbar"><div className="overview-tools">{tools.filter(t=>editable||t[0]==='pan').map(([id,label,Icon])=><button className={`button ${tool===id?'primary':''}`} key={id} onClick={()=>setTool(id)} aria-pressed={tool===id}><Icon size={15}/>{label}</button>)}{editable&&<><button className={`button ${tool==='fill'?'primary':''}`} onClick={()=>setTool('fill')}>填充</button><button className="icon-button" aria-label="撤销势力图修改" disabled={!doc.canUndo} onClick={()=>{doc.undo();onChange();}}><Undo2 size={16}/></button><button className="icon-button" aria-label="重做势力图修改" disabled={!doc.canRedo} onClick={()=>{doc.redo();onChange();}}><Redo2 size={16}/></button></>}</div><div className="overview-tools"><label>缩放 <input aria-label="势力图缩放" type="range" min="0" max="4" value={[2,4,8,12,16].indexOf(zoom)} onChange={e=>setZoom([2,4,8,12,16][e.target.value])}/><span>×{zoom}</span></label><button className="icon-button" aria-label="势力图网格" aria-pressed={grid} onClick={()=>setGrid(!grid)}><Grid2X2 size={16}/></button><button className="button" onPointerDown={()=>setCompare(true)} onPointerUp={()=>setCompare(false)} onPointerLeave={()=>setCompare(false)} onBlur={()=>setCompare(false)} onKeyDown={e=>{if(e.key===' ')setCompare(true);}} onKeyUp={()=>setCompare(false)}>按住对比</button></div></div>
  {error&&<div className="overview-error" role="alert">{error}<button className="icon-button" aria-label="关闭绘制提示" onClick={()=>setError('')}><X size={16}/></button></div>}
  <div className="overview-layout"><div className="overview-map"><div ref={view} tabIndex={0} onKeyDown={key} className={`overview-viewport ${tool!=='pan'&&editable?'drawing':''}`} aria-label="势力图画布"><div className="overview-plane" style={{width:640*zoom,height:224*zoom}} onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={()=>{gesture.current=null;setTick(n=>n+1);}} onContextMenu={e=>e.preventDefault()}><canvas ref={canvas} style={{width:640*zoom,height:224*zoom}}/><canvas ref={overlay} className="overview-overlay"/><span className="overview-lock-label" style={{left:128*zoom+12}}>原版参考 · 只读</span></div></div><div className="overview-status"><span>{hover?`X ${hover.x} · Y ${hover.y}${model.protectedPixel(hover.x,hover.y)?' · 受保护':''}`:'本州西端 · 128×224像素'}</span><span>{compare?'导入时的图像':editable?`自绘图案 ${model.usedPatterns} / ${model.capacity}`:'仅浏览 · 电脑解锁后可绘制'}</span></div></div>
  {editable&&<aside className="overview-side"><div className="overview-palette">{OVERVIEW_COLORS.map(v=><button key={v} title={NAMES[v]} aria-label={`底图颜色 ${NAMES[v]}`} aria-pressed={!stamp&&color===v} style={{background:`rgb(${model.palette[v]})`}} onClick={()=>{setColor(v);setStamp(null);setTool('brush');}}/>)}</div><div className="overview-sizes">{[1,2,4,8].map(n=><button className="button" key={n} aria-pressed={!stamp&&size===n} onClick={()=>{setSize(n);setStamp(null);setTool('brush');}}>{n}px</button>)}</div><div className="overview-tile-tabs">{[['land','陆地・点阵'],['coast','海岸'],['sea','海面']].map(([id,label])=><button className="button" key={id} aria-pressed={group===id} onClick={()=>{setGroup(id);setLimit(48);}}>{label}</button>)}</div><div className="overview-tile-list">{tiles.slice(0,limit).map(t=><button key={t.id} title={`原版图块 #${t.id}`} aria-label={`原版图块 ${t.id}`} onClick={()=>{setStamp({width:8,height:8,pixels:Array.from(t.pixels)});setTool('brush');}}><Tile pixels={t.pixels} palette={model.palette}/></button>)}</div>{tiles.length>limit&&<button className="button" onClick={()=>setLimit(n=>n+48)}>显示更多图块</button>}<div className="overview-selection"><button className="button" onClick={()=>{setTool('rect');setSelection({x0:0,y0:0,x1:127,y1:223});}}>全选西端</button><button className="button" disabled={!selection} onClick={fillSelection}>选区填色</button><button className="button" disabled={!selection} onClick={restore}><RotateCcw size={14}/>还原选区</button></div><p>只编辑左侧西端底图。城点、道路及原版区域受保护。右键吸色；组合取样会忽略城点与道路。</p><p>{stamp?`盖章 ${stamp.width}×${stamp.height} 像素`:`画笔 ${size}px`} · 使用顶部「导出 ROM」保存。刷新会保留工作副本；还原以导入文件为准，也可以撤销。</p></aside>}
  </div>
 </section>;
}
