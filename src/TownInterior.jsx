import {useEffect,useMemo,useRef,useState} from 'react';
import {readTownInterior} from './rom/town-interior.js';
import {loadTownArt} from './rom/town-art.js';
import ModalWindow from './ModalWindow.jsx';
import TownMapEditor from './TownMapEditor.jsx';
export default function TownInterior({bytes,town,doc,revision,mode='read',onChange}){
 const canvas=useRef(null),[cell,setCell]=useState(null),[open,setOpen]=useState(false);
 const result=useMemo(()=>{try{return {map:readTownInterior(bytes,town.id),art:loadTownArt(bytes)};}catch(error){return {error};}},[bytes,town.id]);
 useEffect(()=>{setCell(null);const {map,art}=result;if(!map)return;const ctx=canvas.current.getContext('2d'),im=ctx.createImageData(16,16);for(let y=0;y<24;y++)for(let x=0;x<32;x++){im.data.set(art.tile(map.cells[y*32+x]));ctx.putImageData(im,x*16,y*16);}},[result]);
 return <section className="town-interior"><h3 className="section-title">町内地图</h3>{result.error?<p role="status">{result.error.message}</p>:<><p className="caption">原版图块 · 32×24 格</p><canvas ref={canvas} width={512} height={384} aria-label={`${town.name}内部地图布局`} onClick={e=>{const r=e.currentTarget.getBoundingClientRect(),x=Math.min(31,Math.floor((e.clientX-r.left)/r.width*32)),y=Math.min(23,Math.floor((e.clientY-r.top)/r.height*24));setCell({x,y,code:result.map.cells[y*32+x]});}}/>{cell&&<p className="caption">X {cell.x} · Y {cell.y} · 图块 {cell.code}</p>}{doc&&<button className="button" onClick={()=>setOpen(true)}>{mode==='edit'?'编辑町内地图':'打开町内地图'}</button>}</>}{open&&<ModalWindow title={`${town.name} · 町内地图`} className="map-tools-dialog" onClose={()=>setOpen(false)}><TownMapEditor doc={doc} revision={revision} mode={mode} onChange={onChange} initialTown={town.id}/></ModalWindow>}</section>;
}
