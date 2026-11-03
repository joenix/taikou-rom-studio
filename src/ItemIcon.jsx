import {useEffect,useMemo,useRef,useState} from 'react';
import {itemIconImage} from './rom/item-icons.js';
export function ItemIcon({bytes,selector}){
 const canvas=useRef(null),[error,setError]=useState('');
 useEffect(()=>{try{const im=itemIconImage(bytes,selector),ctx=canvas.current.getContext('2d'),data=ctx.createImageData(32,32);im.indices.forEach((n,i)=>data.data.set([...im.colors[n],255],i*4));ctx.putImageData(data,0,0);setError('');}catch(e){canvas.current.getContext('2d').clearRect(0,0,32,32);setError(e.message);}},[bytes,selector]);
 return <div>{error&&<small role="alert">{error}</small>}<canvas ref={canvas} width="32" height="32" style={{width:64,height:64,imageRendering:'pixelated'}} aria-label={`宝物图标 ${selector}`}/></div>;
}
export function ItemIconPicker({doc,selector,onChange}){
 const bytes=useMemo(()=>doc.workingBytes,[doc,doc.revision]);
 return <section><h3>游戏内图标</h3><ItemIcon bytes={bytes} selector={selector}/><div className="item-icon-grid">{Array.from({length:20},(_,id)=><button type="button" key={id} aria-label={`选择宝物图标 ${id}`} aria-pressed={selector===id} className={selector===id?'selected':''} onClick={()=>onChange(id)}><ItemIcon bytes={bytes} selector={id}/><small>#{id}</small></button>)}</div><p className="caption">独立更换此宝物的详情图标；保留原类别、效果和数值。首次应用会安装图标引用扩展。</p></section>;
}
