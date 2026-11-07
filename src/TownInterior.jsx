import {useEffect,useMemo,useRef,useState} from 'react';
import {readTownInterior} from './rom/town-interior.js';
export default function TownInterior({bytes,town}){
 const canvas=useRef(null),[cell,setCell]=useState(null);
 const result=useMemo(()=>{try{return {map:readTownInterior(bytes,town.id)};}catch(error){return {error};}},[bytes,town.id]);
 useEffect(()=>{setCell(null);const map=result.map;if(!map)return;const ctx=canvas.current.getContext('2d');for(let y=0;y<24;y++)for(let x=0;x<32;x++){const v=map.cells[y*32+x];ctx.fillStyle=v<0?'#e4e4e4':v&128?'#8e4f39':v>=105?'#bd9864':v>=80?'#e7d4a4':'#6c8e78';ctx.fillRect(x*8,y*8,8,8);}ctx.strokeStyle='#ffffff44';for(let x=0;x<=32;x++){ctx.beginPath();ctx.moveTo(x*8,0);ctx.lineTo(x*8,192);ctx.stroke();}for(let y=0;y<=24;y++){ctx.beginPath();ctx.moveTo(0,y*8);ctx.lineTo(256,y*8);ctx.stroke();}},[result]);
 return <section className="town-interior"><h3 className="section-title">町内地图</h3>{result.error?<p role="status">{result.error.message}</p>:<><p className="caption">ROM 真实布局 · 32×24 格 · 地形示意，非游戏原画</p><canvas ref={canvas} width={256} height={192} tabIndex={0} aria-label={`${town.name}内部地图布局`} onClick={e=>{const r=e.currentTarget.getBoundingClientRect(),x=Math.min(31,Math.floor((e.clientX-r.left)/r.width*32)),y=Math.min(23,Math.floor((e.clientY-r.top)/r.height*24));setCell({x,y,code:result.map.cells[y*32+x]});}}/>{cell&&<p className="caption">X {cell.x} · Y {cell.y} · 图块原码 {cell.code<0?'未分配':cell.code}</p>}<p className="caption">仅浏览布局；颜色用于区分原码分组，不代表已核实的设施或通行规则。</p></>}</section>;
}
