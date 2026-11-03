import {useEffect,useRef} from 'react';
export default function PlaceGlyph({art,kind='castle',size=0,code=64}){
 const ref=useRef(null);
 useEffect(()=>{if(!art||!ref.current)return;const ctx=ref.current.getContext('2d'),im=ctx.createImageData(16,16);ctx.clearRect(0,0,32,32);if(kind==='castle'){for(let part=0;part<4;part++){im.data.set(art.castle((size&3)|4,part));ctx.putImageData(im,(part&1)*16,(part>>>1)*16);}}else{im.data.set(art.terrain(code));ctx.putImageData(im,8,8);}},[art,kind,size,code]);
 return art?<canvas ref={ref} width="32" height="32" className="place-glyph" aria-label={kind==='castle'?`城池原画，规模${size+1}`:'町入口原画'}/>:null;
}
