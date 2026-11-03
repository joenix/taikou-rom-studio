import {Eye} from 'lucide-react';
import ModalWindow from './ModalWindow.jsx';
import {MapDialog} from './MapWorkspace.jsx';
import ZoomSlider from './ZoomSlider.jsx';
import {useMapPan} from './map-pan.js';
import PlaceGlyph from './PlaceGlyph.jsx';
import NativeWorldCanvas from './NativeWorldCanvas.jsx';
import {loadWorldArt} from './rom/world-art.js';
import {useEffect,useMemo,useRef,useState} from 'react';
import {WORLD,terrainColor} from './rom/world-map.js';

export default function CastleAtlas({doc,revision,castles,selectedId,onSelect,renderDetail,mode,onEditCastle,onChange}){
 const capability=useMemo(()=>doc.mapCapability,[doc,revision]);
 const map=useMemo(()=>capability.supported?doc.mapSnapshot():null,[doc,revision,capability]);
 const [query,setQuery]=useState(''),[zoom,setZoom]=useState(8),[focusRequest,setFocusRequest]=useState(0),[artMode,setArtMode]=useState('native'),[season,setSeason]=useState(1),[townId,setTownId]=useState(null),[placeType,setPlaceType]=useState('all');
 const [detailOpen,setDetailOpen]=useState(false),[townEditor,setTownEditor]=useState(null);
 const rom=useMemo(()=>doc.workingBytes,[doc,revision]);
 const native=useMemo(()=>{try{return {art:loadWorldArt(rom,season)};}catch(error){return {error};}},[rom,season]);
 const showNative=artMode==='native'&&native.art;
 const canvas=useRef(null),viewport=useRef(null),list=useRef(null);
 useMapPan(viewport,true,zoom);
 const castle=castles.find(c=>c.id===selectedId)||castles[0];
 const town=map?.places.towns.find(t=>t.id===townId&&t.active);
 const selected=town||castle;
 const selectedKey=town?`town:${town.id}`:`castle:${castle.id}`;
 const locations=useMemo(()=>new Map(map?.places.castles.flatMap(p=>p.aliases.map(id=>[id,p]))||[]),[map]);
 const place=town||locations.get(castle?.id);
 const entries=[...castles.map(c=>({...c,key:`castle:${c.id}`,kind:'castle',place:locations.get(c.id)})),...(map?.places.towns.filter(t=>t.active).map(t=>({...t,key:`town:${t.id}`,kind:'town',place:t}))||[])];
 function choose(p){setDetailOpen(false);setFocusRequest(n=>n+1);if(p.kind==='town'||p.kind==='map-town')setTownId(p.id);else{setTownId(null);onSelect(p.id);}}
 const filtered=entries.filter(c=>(placeType==='all'||c.kind===placeType)&&`${c.id} ${String(c.id).padStart(4,'0')} ${c.name}`.toLowerCase().includes(query.trim().toLowerCase()));
 useEffect(()=>{
  if(!map||!canvas.current||showNative)return;
  const ctx=canvas.current.getContext('2d');
  // Paint once at native logical resolution; zoom uses the canvas display size.
  for(let i=0;i<map.cells.length;i++){const color=map.cells[i]<0?'#9fc4e6':terrainColor(map.cells[i]);ctx.fillStyle=color;ctx.fillRect(i%WORLD.width,Math.floor(i/WORLD.width),1,1);}
 },[map,showNative]);
 useEffect(()=>{
  if(!place||!viewport.current)return;
  const view=viewport.current;
  view.scrollTo({left:Math.max(0,place.x*zoom-view.clientWidth/2),top:Math.max(0,place.y*zoom-view.clientHeight/2),behavior:'auto'});
  const row=list.current?.querySelector(`[data-place-key="${selectedKey}"]`);
  if(row){const panel=list.current;if(row.offsetTop<panel.scrollTop||row.offsetTop+row.offsetHeight>panel.scrollTop+panel.clientHeight)panel.scrollTop=Math.max(0,row.offsetTop-panel.clientHeight/2);}
 },[place,selectedKey,zoom,query,focusRequest]);
 if(!map)return <div className="inline-note">这份 ROM 的地图布局未通过校验：{capability.error?.message}。仍可切换列表查看城池。</div>;
 return <section className="castle-atlas" aria-label="城与町地图浏览">
  <div className="castle-atlas-list"><label>查找城与町<input aria-label="搜索地图地点" value={query} onChange={e=>setQuery(e.target.value)} placeholder="城、町名称或编号"/></label><select aria-label="浏览地点类型" value={placeType} onChange={e=>setPlaceType(e.target.value)}><option value="all">城与町</option><option value="castle">城</option><option value="town">町</option></select><p className="caption">{filtered.length} 条资料 · {map.places.castles.length} 城 · {map.places.towns.filter(t=>t.active).length} 町</p><div className="castle-atlas-rows" ref={list}>{filtered.map(c=>{const p=c.place;return <button type="button" key={c.key} data-place-key={c.key} aria-pressed={selectedKey===c.key} className={selectedKey===c.key?'selected':''} onClick={()=>choose(c)}><span className="atlas-entry"><PlaceGlyph art={native.art} kind={c.kind} size={c.state?.size||0} code={p?.kind==='map-town'?map.cells[p.y*328+p.x]:64}/><span>{c.name}<small>{c.kind==='castle'?`城 · 规模 ${['Ⅰ','Ⅱ','Ⅲ','Ⅳ'][c.state?.size||0]}`:'町'} · #{c.id}</small></span></span><small>{p?`X ${p.x} · Y ${p.y}`:'无已确认位置'}</small></button>;})}{!filtered.length&&<p className="muted">没有匹配的地点</p>}</div></div>
  <div className="castle-atlas-main"><div className="castle-atlas-toolbar"><div><strong>{selected.name}</strong><span>{place?`X ${place.x} · Y ${place.y}`:'无已确认位置'}</span></div><label>地图 <select aria-label="地图画面" value={artMode} onChange={e=>setArtMode(e.target.value)}><option value="native" disabled={!native.art}>游戏原画（静态）</option><option value="diagram">地形示意</option></select></label>{showNative&&<label>季节 <select aria-label="地图季节" value={season} onChange={e=>setSeason(Number(e.target.value))}>{['冬','春','夏','秋'].map((name,i)=><option key={i} value={i}>{name}</option>)}</select></label>}<button type="button" className="button" onClick={()=>setFocusRequest(n=>n+1)}>定位当前地点</button><ZoomSlider value={zoom} onChange={setZoom} label="城池地图缩放"/></div>
  <div ref={viewport} className="castle-atlas-viewport"><div className="castle-atlas-plane" style={{width:WORLD.width*zoom,height:WORLD.height*zoom}}>{showNative?<NativeWorldCanvas rom={rom} map={map} art={native.art} zoom={zoom} viewport={viewport}/>:<canvas ref={canvas} width={WORLD.width} height={WORLD.height} style={{width:'100%',height:'100%'}} aria-label="城池位置示意地图"/>}{map.places.all.flatMap(p=>p.entrances.map((entrance,index)=>{const isCastle=p.kind==='map-castle',w=isCastle?2:1,h=isCastle?2:1;return <button type="button" key={`${p.key}:${index}`} className={`place-hit${p===place?' selected':''}`} style={{left:entrance.x*zoom,top:(entrance.y-(isCastle?1:0))*zoom,width:w*zoom,height:h*zoom}} aria-label={`地图${isCastle?'城池':'町'} ${p.name}，X ${entrance.x}，Y ${entrance.y}`} aria-pressed={p===place} title={`${p.name} · ${isCastle?`规模 ${['Ⅰ','Ⅱ','Ⅲ','Ⅳ'][castles[p.id].state?.size||0]}`:'町'} · X ${entrance.x} Y ${entrance.y}`} onClick={()=>choose(p)}>{!showNative&&<PlaceGlyph art={native.art} kind={isCastle?'castle':'town'} size={castles[p.id]?.state?.size||0} code={isCastle?64:map.cells[entrance.y*328+entrance.x]}/>}</button>;}))}{place&&<span className="castle-pin-label" style={{left:(place.x+1)*zoom,top:(place.y+.5)*zoom}}>{selected.name}<button type="button" className="place-detail-eye" aria-label={`查看${selected.name}详情`} title="查看详情" onClick={()=>setDetailOpen(true)}><Eye size={15}/></button></span>}</div></div>
  <p className="caption">{showNative?'ROM 开局数据 · 浅蓝海纹为预览补绘':'逻辑地形示意 · ROM 开局数据'}{native.error&&`原画暂不可用：${native.error.message}。`}{place?.aliases?.length>1&&`此位置共用资料：${place.aliases.map(id=>castles[id].name).join('、')}。`}</p>
  {detailOpen&&<ModalWindow title={`${town?'町':'城'} · ${selected.name}`} className="place-detail-dialog" onClose={()=>setDetailOpen(false)} actions={mode==='edit'&&<button type="button" className="button primary" onClick={()=>{if(town)setTownEditor({action:'edit',place:town,revision:doc.revision});else onEditCastle(castle);}}>{town?'编辑町':'编辑城池'}</button>}>
   {town?<aside className="inspector"><div className="inspector-body"><div className="inspector-heading"><span className="record-number">町 #{town.id}</span><h2>{town.name}</h2></div><PlaceGlyph art={native.art} kind="town" code={map.cells[town.y*328+town.x]}/><dl className="facts"><div><dt>坐标</dt><dd>X {town.x} · Y {town.y}</dd></div><div><dt>入口数</dt><dd>{town.entrances.length}</dd></div></dl><h3 className="section-title">町入口</h3>{town.entrances.map(e=><p key={e.slot}>X {e.x} · Y {e.y}</p>)}<p className="caption">町没有城池的石高、兵力和城主属性，资料分别展示。</p></div></aside>:renderDetail(castle,()=>{setDetailOpen(false);setFocusRequest(n=>n+1);})}
  </ModalWindow>}
  {townEditor&&mode==='edit'&&<MapDialog state={townEditor} doc={doc} code={19} close={()=>setTownEditor(null)} done={()=>{setTownEditor(null);setDetailOpen(true);onChange();}}/>}

  </div>
 </section>;
}
