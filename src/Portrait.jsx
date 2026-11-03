import {useEffect,useMemo,useRef,useState} from 'react';
import {portraitImage} from './rom/portraits.js';
export function Portrait({doc,bytes,selector,small=false}){
 const canvas=useRef(null),[error,setError]=useState('');
 const revision=doc?.revision;
 useEffect(()=>{try{const image=portraitImage(bytes||doc.workingBytes,selector),ctx=canvas.current.getContext('2d'),data=ctx.createImageData(32,40);image.indices.forEach((v,i)=>{data.data.set([...image.colors[v],255],i*4);});ctx.putImageData(data,0,0);setError('');}catch(e){canvas.current.getContext('2d').clearRect(0,0,32,40);setError(e.message);}},[doc,revision,bytes,selector]);
 return <div className={small?'portrait-image small':'portrait-image'}><canvas ref={canvas} width="32" height="40" aria-label={`ROM头像引用 ${selector}`}/>{error&&<p role="alert">{error}</p>}</div>;
}
const COLUMNS=6,ROW_HEIGHT=90,VIEW_HEIGHT=270,OVERSCAN=2;
export function PortraitPicker({doc,person,selector,onChange}){
 const [donor,setDonor]=useState(null),[query,setQuery]=useState(''),[scroll,setScroll]=useState(0),viewport=useRef(null);
 const revision=doc.revision;
 const bytes=useMemo(()=>doc.workingBytes,[doc,revision]);
 const people=useMemo(()=>Array.from({length:713},(_,id)=>doc.readPerson(id)),[doc,revision]);
 const matches=useMemo(()=>people.filter(p=>`${p.id} ${p.name}`.toLowerCase().includes(query.trim().toLowerCase())),[people,query]);
 const start=Math.max(0,Math.floor(scroll/ROW_HEIGHT)-OVERSCAN),end=Math.min(Math.ceil(matches.length/COLUMNS),Math.ceil((scroll+VIEW_HEIGHT)/ROW_HEIGHT)+OVERSCAN);
 const visible=matches.slice(start*COLUMNS,end*COLUMNS);
 function search(value){setQuery(value);setScroll(0);if(viewport.current)viewport.current.scrollTop=0;}
 return <section className="portrait-picker"><h3>游戏内头像</h3><div className="portrait-preview"><Portrait bytes={bytes} selector={selector}/><div><strong>当前草稿头像</strong><p>{donor!==null?`已选择：${people[donor].name}`:person.name}</p><small>点击下方画像立即预览，应用后写入 ROM。</small></div></div><label className="portrait-search">查找头像<input aria-label="搜索头像武将" placeholder="武将姓名或编号" value={query} onChange={e=>search(e.target.value)}/></label><p className="caption">{matches.length} 位武将 · 滚动查看全部画像</p><div ref={viewport} className="portrait-viewport" style={{height:VIEW_HEIGHT}} onScroll={e=>setScroll(e.currentTarget.scrollTop)} tabIndex={0} aria-label="武将头像列表"><div style={{height:Math.ceil(matches.length/COLUMNS)*ROW_HEIGHT,position:'relative'}}><div className="portrait-grid" style={{position:'absolute',top:start*ROW_HEIGHT,left:0,right:0,gridTemplateColumns:`repeat(${COLUMNS},minmax(0,1fr))`,gridAutoRows:ROW_HEIGHT}}>{visible.map(p=><button type="button" key={p.id} className={`portrait-option${p.selector===selector?' selected':''}`} aria-pressed={p.selector===selector} aria-label={`使用${p.name}的头像`} onClick={()=>{setDonor(p.id);onChange(p.selector);}}><Portrait bytes={bytes} selector={p.selector} small/><span title={p.name}>{p.name}</span><small>#{p.id}</small></button>)}</div></div>{!matches.length&&<p>没有匹配的武将</p>}</div><p className="caption">使用游戏状态页原色板。复用真实头像引用；共享同一引用的武将会同时标示为选中。</p></section>;
}
