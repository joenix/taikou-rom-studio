import ZoomSlider from './ZoomSlider.jsx';
import {useMapPan} from './map-pan.js';
import NativeWorldCanvas from './NativeWorldCanvas.jsx';
import {loadWorldArt} from './rom/world-art.js';
import {useEffect,useMemo,useRef,useState} from 'react';
import {WORLD,terrainColor,terrainLabel} from './rom/world-map.js';
import {hex} from './rom/profile.js';
function Alert({error}){return error?<div className="error-message" role="alert"><div><strong>{error.message}</strong><small>{error.code}</small></div></div>:null;}
export default function MapWorkspace({doc,revision,mode,onChange,embedded=false}){
 const capability=useMemo(()=>doc.mapCapability,[doc,revision]);
 const map=useMemo(()=>capability.supported?doc.mapSnapshot():null,[doc,revision,capability]);
 const townCapability=useMemo(()=>doc.townCapability,[doc,revision]);
 const data=useMemo(()=>doc.snapshot(),[doc,revision]);
 const [artMode,setArtMode]=useState('native'),[season,setSeason]=useState(1);
 const rom=useMemo(()=>doc.workingBytes,[doc,revision]);
 const native=useMemo(()=>{try{return {art:loadWorldArt(rom,season)};}catch(error){return {error};}},[rom,season]);
 const showNative=artMode==='native'&&native.art;
 const canvas=useRef(null),viewport=useRef(null),anchor=useRef(null);
 const [viewportVersion,setViewportVersion]=useState(0);
 useEffect(()=>{const view=viewport.current;if(!view)return;let frame=0;const update=()=>{cancelAnimationFrame(frame);frame=requestAnimationFrame(()=>setViewportVersion(n=>n+1));};view.addEventListener('scroll',update,{passive:true});const observer=new ResizeObserver(update);observer.observe(view);return()=>{view.removeEventListener('scroll',update);observer.disconnect();cancelAnimationFrame(frame);};},[map]);
 const [zoom,setZoom]=useState(12),[grid,setGrid]=useState(false),[selection,setSelection]=useState(null),[selected,setSelected]=useState(null),[query,setQuery]=useState(''),[filter,setFilter]=useState('all'),[tool,setTool]=useState('pan'),[code,setCode]=useState(19),[error,setError]=useState(null),[dialog,setDialog]=useState(null),[locate,setLocate]=useState({x:176,y:120});
 useMapPan(viewport,tool==='pan',zoom);
 const minX=map?.minX??0,minY=map?.minY??0,maxX=map?.maxX??WORLD.width-1,maxY=map?.maxY??WORLD.height-1;
 const place=map?.places.all.find(p=>p.key===selected);
 const editorTown=map?.places.towns.find(p=>p.editorCreated);
 const filtered=map?.places.all.filter(p=>(filter==='all'||p.kind===filter)&&`${p.name} ${p.id}`.toLowerCase().includes(query.toLowerCase()))||[];
 const occupied=useMemo(()=>new Map(map?.places.all.flatMap(p=>p.entrances.flatMap(e=>Array.from({length:e.width},(_,i)=>[`${e.x+i},${e.y}`,p.key])))||[]),[map]);
 useEffect(()=>{
  if(!map||!canvas.current)return;
  const c=canvas.current,ctx=c.getContext('2d'),view=viewport.current;c.width=view.clientWidth;c.height=view.clientHeight;c.style.left=`${view.scrollLeft}px`;c.style.top=`${view.scrollTop}px`;ctx.translate(-view.scrollLeft,-view.scrollTop);
  if(!showNative)for(let y=0;y<map.height;y++)for(let x=0;x<map.width;x++){const code=map.cells[y*map.width+x];ctx.fillStyle=code<0?'#9fc4e6':terrainColor(code);ctx.fillRect(x*zoom,y*zoom,zoom,zoom);}
  if(grid){ctx.strokeStyle='#ffffff66';ctx.lineWidth=1;ctx.beginPath();for(let x=0;x<=map.width;x+=8){ctx.moveTo(x*zoom,0);ctx.lineTo(x*zoom,map.height*zoom);}for(let y=0;y<=map.height;y+=8){ctx.moveTo(0,y*zoom);ctx.lineTo(map.width*zoom,y*zoom);}ctx.stroke();}
  if(place){ctx.strokeStyle='#fff';ctx.lineWidth=2;for(const e of place.entrances)ctx.strokeRect((e.x-minX)*zoom-2,(e.y-minY)*zoom-2,e.width*zoom+4,zoom+4);}
  if(selection){ctx.strokeStyle='#7c223a';ctx.lineWidth=2;ctx.strokeRect((Math.min(selection.x0,selection.x1)-minX)*zoom,(Math.min(selection.y0,selection.y1)-minY)*zoom,(Math.abs(selection.x1-selection.x0)+1)*zoom,(Math.abs(selection.y1-selection.y0)+1)*zoom);}
 },[map,zoom,grid,selection,place,showNative,viewportVersion,minX,minY]);
 function select(x,y){setSelection({x0:x,y0:y,x1:x,y1:y});setSelected(occupied.get(`${x},${y}`)||null);setError(null);}
 function point(e){const view=viewport.current,r=view.getBoundingClientRect();return {x:Math.min(maxX,Math.max(minX,minX+Math.floor((e.clientX-r.left-view.clientLeft+view.scrollLeft)/zoom))),y:Math.min(maxY,Math.max(minY,minY+Math.floor((e.clientY-r.top-view.clientTop+view.scrollTop)/zoom)))};}
 function start(e){if(tool==='pan')return;const p=point(e);canvas.current.setPointerCapture(e.pointerId);anchor.current=p;select(p.x,p.y);if(tool==='pick'){const value=map.cells[(p.y-minY)*map.width+p.x-minX];if(value>=0&&value<64)setCode(value);}}
 function move(e){if(!anchor.current||tool==='pick')return;const p=point(e);setSelection({x0:anchor.current.x,y0:anchor.current.y,x1:p.x,y1:p.y});}
 function focus(x,y){select(x,y);viewport.current?.scrollTo({left:Math.max(0,(x-minX)*zoom-220),top:Math.max(0,(y-minY)*zoom-180),behavior:'smooth'});}
 function go(){const x=Number(locate.x),y=Number(locate.y);if(!Number.isInteger(x)||!Number.isInteger(y)||x<minX||x>maxX||y<minY||y>maxY){setError({code:'INVALID_COORDINATE',message:`坐标应为 X ${minX}–${maxX}、Y ${minY}–${maxY} 的整数`});return;}focus(x,y);}
 function apply(){try{doc.applyMap('map-terrain',0,{...selection,code});setError(null);onChange();}catch(e){setError(e);}}
 function open(action){setError(null);setDialog({action,place,revision:doc.revision});}
 function keyboard(e){const delta={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]}[e.key];if(!delta)return;e.preventDefault();select(Math.max(minX,Math.min(maxX,(selection?.x0??minX)+delta[0])),Math.max(minY,Math.min(maxY,(selection?.y0??minY)+delta[1])));}
 if(!map)return <section className="history-view"><h1>地图布局尚未匹配</h1><p>{capability.error.message}</p><code>{capability.error.code}</code><p>其他资料仍可查阅；地图写入已停止。</p></section>;
 const cell=selection?map.cells[(selection.y0-minY)*map.width+selection.x0-minX]:null;
 return <section className="map-workspace">
  {!embedded&&<div className="page-heading"><div><h1>地图编辑</h1><p>{map.width} × {map.height} 逻辑格（X {minX}–{maxX} · Y {minY}–{maxY}）· {map.places.castles.length} 座城 · {map.places.towns.filter(p=>p.active).length} 个町</p></div><span className="result-total">地形与地点</span></div>}
  <div className="map-toolbar"><label>画面 <select aria-label="地图工坊画面" value={artMode} onChange={e=>setArtMode(e.target.value)}><option value="native" disabled={!native.art}>游戏原画（静态）</option><option value="diagram">地形示意</option></select></label>{showNative&&<label>季节 <select aria-label="地图工坊季节" value={season} onChange={e=>setSeason(Number(e.target.value))}>{['冬','春','夏','秋'].map((name,i)=><option key={i} value={i}>{name}</option>)}</select></label>}<ZoomSlider value={zoom} onChange={setZoom} label="地图缩放"/><label><input type="checkbox" checked={grid} onChange={e=>setGrid(e.target.checked)}/>分区网格</label><button className={'button '+(tool==='pan'?'primary':'')} onClick={()=>setTool('pan')}>拖动地图</button><button className={'button '+(tool==='select'?'primary':'')} onClick={()=>setTool('select')}>选区</button><button className={'button '+(tool==='pick'?'primary':'')} onClick={()=>setTool('pick')}>吸取地形</button><span className="caption">{tool==='pan'?'拖拽平移 · 松手惯性滑动 · 点击查看地点':'拖动框选 · 吸取地形 · 方向键移动选中格'}</span></div>
  <Alert error={error}/>
  <div className="map-layout"><div>
   <div className="map-viewport" ref={viewport}><div className="map-native-plane" style={{position:'relative',width:map.width*zoom,height:map.height*zoom}}>{showNative&&<NativeWorldCanvas rom={rom} map={map} art={native.art} zoom={zoom} viewport={viewport}/>}<canvas ref={canvas} tabIndex={0} aria-label="太阁大地图，拖动选择地形或点击地点" onKeyDown={keyboard} onClick={e=>{if(tool==='pan'){const p=point(e);select(p.x,p.y);}}} onPointerDown={start} onPointerMove={move} onPointerUp={()=>anchor.current=null} onPointerCancel={()=>anchor.current=null} style={{position:'absolute'}}/></div></div>
   <div className="map-coordinate">{selection?`X ${selection.x0} · Y ${selection.y0} → X ${selection.x1} · Y ${selection.y1} ｜ ${terrainLabel(cell)}`:'点击地图查看坐标；点击城或町标记查看地点'}</div>
   <div className="map-legend"><span><i style={{background:terrainColor(128)}}/>城</span><span><i style={{background:terrainColor(64)}}/>町入口</span><span><i style={{background:'#9fc4e6'}}/>预览补海</span><small>{showNative?'原ROM图块拼接；日间静态预览，开局城池规模、统一非己方样式，不表示实时归属。':'符号配色，非游戏原画。'}地形原码的通行效果需在游戏内确认。{native.error&&`原画暂不可用：${native.error.message}。`}</small></div>
   <div className="map-toolbar"><label>X <input aria-label="定位 X" type="number" min={minX} max={maxX} value={locate.x} onChange={e=>setLocate(v=>({...v,x:e.target.value}))}/></label><label>Y <input aria-label="定位 Y" type="number" min={minY} max={maxY} value={locate.y} onChange={e=>setLocate(v=>({...v,y:e.target.value}))}/></label><button className="button" onClick={go}>定位坐标</button></div>
   <div className="map-panel"><h3>地形编辑</h3><p className="caption">选中单格或矩形后应用。原码决定图块与通行效果；使用吸取工具可以复制附近地形。</p><div className="map-palette">{map.palette.map(p=><button key={p.code} aria-label={`地形 ${hex(p.code,2)}`} aria-pressed={code===p.code} className={code===p.code?'chosen':''} title={`${hex(p.code,2)} · ${p.count} 格`} onClick={()=>setCode(p.code)}><i style={{background:terrainColor(p.code)}}/>{hex(p.code,2)}</button>)}</div><div className="map-toolbar"><label>地形原码 <input aria-label="地形原码" type="number" min="0" max="63" value={Number.isNaN(code)?'':code} onChange={e=>setCode(e.target.value===''?NaN:Number(e.target.value))}/></label><button className="button primary" disabled={mode!=='edit'||!selection} onClick={apply}>应用到选区</button><small>选区整体提交；城、町入口受保护；支持撤销。</small></div></div>
   
  </div><aside className="map-side">
   <div className="map-panel"><h3>地点目录</h3><input aria-label="搜索地图地点" placeholder="搜索城、町、编号" value={query} onChange={e=>setQuery(e.target.value)}/><select aria-label="地点类型" value={filter} onChange={e=>setFilter(e.target.value)}><option value="all">全部地点</option><option value="map-castle">城</option><option value="map-town">町</option></select><div className="map-place-list">{filtered.map(p=><button key={p.key} className={p.key===selected?'selected':''} onClick={()=>focus(p.x,p.y)}><span>{p.kind==='map-castle'?'城':'町'} · {p.name}{p.editorCreated?' ＋':''}</span><small>{p.x}, {p.y}</small></button>)}</div></div>
   {place&&<div className="map-panel"><h3>{place.name}</h3><p>坐标 {place.x}, {place.y} · {place.entrances.length} 个入口</p>{place.aliases?.length>1&&<p className="caption">与剧情异名记录 #{place.aliases.slice(1).join('、')} 共用位置，移动会同步。</p>}{place.kind==='map-castle'&&<p className="caption">已知引用：初始驻将 {data.castles[place.id].residents.length} 人；其他城邻接候选 {data.castles.filter(c=>c.neighbors.includes(place.id)).length} 条。剧情引用尚未完整识别。</p>}<button className="button primary" disabled={mode!=='edit'} onClick={()=>open('edit')}>编辑此{place.kind==='map-castle'?'城':'町'}</button>{place.editorCreated?<button className="button" disabled={mode!=='edit'} onClick={()=>open('disable')}>删除此新增町</button>:<p className="caption">原有地点涉及人物与剧情引用，本版保留，不开放删除。</p>}</div>}
   <div className="map-panel"><h3>独立新增町</h3>{!townCapability.supported?<p className="caption">{townCapability.error.message}。此 ROM 的现有地图仍可编辑；新增扩展已禁用。</p>:editorTown?.active?<><p>已使用 1 / 1：{editorTown.name}</p><button className="button" onClick={()=>focus(editorTown.x,editorTown.y)}>定位新增町</button></>:editorTown?<><p>已停用：{editorTown.name}</p><button className="button primary" disabled={mode!=='edit'||!selection} onClick={()=>open('restore')}>在选中坐标恢复此町</button><p className="caption">保留原编号和内部资源，不复用为另一个新地点。</p></>:<><p className="caption">先在地图上选中空闲地形，再新建。此操作会安装地图扩展；导出后可重新载入继续编辑。</p><button className="button primary" disabled={mode!=='edit'||!selection||cell<0||cell>=64} onClick={()=>open('create')}>在选中坐标新建町</button></>}</div>
  </aside></div>
  {dialog&&<MapDialog key={dialog.action+dialog.revision} state={dialog} selection={selection} code={code} editorTown={editorTown} towns={map.places.towns.filter(p=>p.id<17)} doc={doc} close={()=>setDialog(null)} done={()=>{onChange();setDialog(null);setError(null);}}/>}
 </section>;
}
export function MapDialog({state,selection,code,editorTown,towns,doc,close,done,embedded=false}){
 const {action,place,revision}=state,ref=useRef(null),[error,setError]=useState(null);
 const [draft,setDraft]=useState(()=>action==='edit'?{name:place.name,x:place.x,y:place.y,fillCode:code,...(place.overview?{overviewX:place.overview.x,overviewY:place.overview.y}:{})}:action==='disable'?{fillCode:Number.isInteger(code)&&code<64&&code>=0?code:19,fallbackTown:0}:{name:editorTown?.name||'新町',x:selection.x0,y:selection.y0});
 useEffect(()=>{const d=ref.current;if(!embedded)d.showModal();return()=>{if(!embedded)d.close();};},[embedded]);
 function submit(e){e.preventDefault();try{const value=Object.fromEntries(Object.entries(draft).map(([k,v])=>[k,k==='name'?v:v===''?NaN:Number(v)]));if(action==='edit')doc.applyMap(place.kind,place.id,value,revision);else doc.applyTown(action,value,revision);done();}catch(e){setError(e);}}
 const Container=embedded?'div':'dialog';
 const title=action==='edit'?`编辑地点 · ${place.name}`:action==='create'?'新建独立町':action==='restore'?'恢复新增町':'删除新增町（停用）';
 const labels={name:'地点名称',x:'地图 X',y:'地图 Y',fillCode:'原址回填地形原码',overviewX:'势力总览 X（独立坐标）',overviewY:'势力总览 Y（独立坐标）',fallbackTown:'驻留者返回的现有町'};
 return <Container className={embedded?'embedded-record-editor':'edit-dialog'} ref={ref} onCancel={e=>{e.preventDefault();close();}} aria-labelledby="map-dialog-title"><form onSubmit={submit} noValidate><div className="dialog-top"><h2 id="map-dialog-title">{title}</h2><button type="button" className="icon-button" onClick={close} aria-label="关闭地点编辑">×</button></div><div className="dialog-body"><Alert error={error}/><div className="form-grid two">{Object.entries(draft).filter(([key])=>!embedded||key==='name').map(([key,value])=><label key={key}>{labels[key]}{key==='fallbackTown'?<select aria-label={labels[key]} value={value} onChange={e=>setDraft(d=>({...d,[key]:e.target.value}))}>{towns.map(t=><option value={t.id} key={t.id}>{t.name}</option>)}</select>:<input aria-label={labels[key]} type={key==='name'?'text':'number'} value={Number.isNaN(value)?'':value} onChange={e=>setDraft(d=>({...d,[key]:e.target.value}))}/>}</label>)}</div><p className="caption">{action==='edit'?'移动会同时更新入口与地图标记；旧址使用指定地形回填。町的多个入口一起移动。城的势力总览使用独立坐标，需单独调整。':action==='disable'?'删除采用停用方式，地图入口会移除；内部场景及编号保留，旧存档中的驻留者出町时返回你选定的现有町。可撤销或恢复。':'采用新发田的设施布局，分配独立地图和町商人状态。名称最多 24 个 Shift-JIS 字节，仅支持原 ROM 可编码字符。'}</p></div><div className="dialog-footer"><button type="button" className="button" onClick={close}>取消</button><button className="button primary" type="submit">{action==='edit'?'应用地点修改':action==='create'?'创建并应用到 ROM':action==='disable'?'停用并处理回程':'恢复并应用到 ROM'}</button></div></form></Container>;
}
