import {oceanPreviewPixels} from './rom/ocean-preview.js';
import {useEffect,useRef} from 'react';
export default function NativeWorldCanvas({rom,map,art,zoom,viewport}){
 const ref=useRef(null);
 useEffect(()=>{
  const view=viewport.current,canvas=ref.current;if(!view||!canvas)return;
  const tiles=new Map(),ocean=oceanPreviewPixels(art.terrain(19));let frame=0;
  function tile(pixels){if(tiles.has(pixels))return tiles.get(pixels);const c=document.createElement('canvas');c.width=c.height=16;const ctx=c.getContext('2d'),im=ctx.createImageData(16,16);im.data.set(pixels);ctx.putImageData(im,0,0);tiles.set(pixels,c);return c;}
  const seaTile=document.createElement('canvas');seaTile.width=seaTile.height=zoom;const seaCtx=seaTile.getContext('2d');seaCtx.imageSmoothingEnabled=false;seaCtx.drawImage(tile(ocean),0,0,zoom,zoom);
  function paint(){
   const left=view.scrollLeft,top=view.scrollTop,w=view.clientWidth,h=view.clientHeight;
   canvas.width=w;canvas.height=h;canvas.style.left=`${left}px`;canvas.style.top=`${top}px`;
   const ctx=canvas.getContext('2d');ctx.imageSmoothingEnabled=false;const ox=(-left)%zoom,oy=(-top)%zoom;ctx.save();ctx.translate(ox,oy);ctx.fillStyle=ctx.createPattern(seaTile,'repeat');ctx.fillRect(-ox,-oy,w,h);ctx.restore();
   const minX=map.minX??0,minY=map.minY??0,width=map.width,height=map.height;
   function stamp(pixels,x,y){ctx.drawImage(tile(pixels),(x-minX)*zoom-left,(y-minY)*zoom-top,zoom,zoom);}
   const x0=Math.max(0,Math.floor(left/zoom)),x1=Math.min(width,Math.ceil((left+w)/zoom)),y0=Math.max(0,Math.floor(top/zoom)),y1=Math.min(height,Math.ceil((top+h)/zoom));
   for(let y=y0;y<y1;y++)for(let x=x0;x<x1;x++){const code=map.cells[y*width+x];if(code>=0&&code<128)stamp(art.terrain(code),x+minX,y+minY);}
   for(const p of map.places.castles){if(p.x-minX+2<x0||p.x-minX>=x1||p.y-minY+1<y0||p.y-minY-1>=y1)continue;const style=p.style??((rom[0x7aab8+p.id*18+15]&3)|4);for(let part=0;part<4;part++)stamp(art.castle(style,part),p.x+(part&1),p.y-1+(part>>>1));}
  }
  function update(){cancelAnimationFrame(frame);frame=requestAnimationFrame(paint);}
  view.addEventListener('scroll',update,{passive:true});const resize=new ResizeObserver(update);resize.observe(view);paint();
  return()=>{view.removeEventListener('scroll',update);resize.disconnect();cancelAnimationFrame(frame);};
 },[rom,map,art,zoom,viewport]);
 return <canvas ref={ref} className="native-world-canvas" aria-label="由当前ROM图块拼接的静态大地图"/>;
}
