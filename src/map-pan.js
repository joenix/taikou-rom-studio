import {useEffect} from 'react';
/** Frame-rate independent, short exponential glide; velocities in pixels/ms. */
export function glide(v,dt){const decay=Math.exp(-Math.max(0,dt)/130);return {distance:v*130*(1-decay),velocity:v*decay};}
export function useMapPan(ref,enabled=true,resetKey=0){
 useEffect(()=>{const view=ref.current;if(!view||!enabled)return;return installMapPan(view);},[ref,enabled,resetKey]);
}
export function installMapPan(view){
  let gesture=null,frame=0,blockClick=false;
  view.classList.add('pan-enabled');
  function stop(){cancelAnimationFrame(frame);frame=0;}
  function finish(){if(gesture&&view.hasPointerCapture(gesture.id))view.releasePointerCapture(gesture.id);gesture=null;delete view.dataset.dragging;}
  function down(e){
   stop();if(!view.contains(e.target)){finish();return;}
   if(e.button!==0||!e.isPrimary||e.target.closest('input,select,textarea'))return;
   finish();blockClick=false;gesture={id:e.pointerId,x:e.clientX,y:e.clientY,lastX:e.clientX,lastY:e.clientY,time:e.timeStamp,startLeft:view.scrollLeft,startTop:view.scrollTop,vx:0,vy:0,moved:false};
  }
  function move(e){
   const g=gesture;if(!g||e.pointerId!==g.id)return;
   if(!g.moved&&Math.hypot(e.clientX-g.x,e.clientY-g.y)<5)return;
   if(!g.moved){g.moved=true;blockClick=true;view.dataset.dragging='true';view.setPointerCapture(g.id);}
   e.preventDefault();e.stopPropagation();
   const dt=Math.max(1,e.timeStamp-g.time),vx=-(e.clientX-g.lastX)/dt,vy=-(e.clientY-g.lastY)/dt;
   g.vx=.3*g.vx+.7*vx;g.vy=.3*g.vy+.7*vy;g.lastX=e.clientX;g.lastY=e.clientY;g.time=e.timeStamp;
   view.scrollLeft=g.startLeft+g.x-e.clientX;view.scrollTop=g.startTop+g.y-e.clientY;
  }
  function up(e){
   const g=gesture;if(!g||e.pointerId!==g.id)return;
   if(!g.moved){finish();return;}
   e.preventDefault();e.stopPropagation();finish();
   if(e.type!=='pointerup'||e.timeStamp-g.time>90||window.matchMedia('(prefers-reduced-motion: reduce)').matches)return;
   let vx=Math.max(-1.8,Math.min(1.8,g.vx*.6)),vy=Math.max(-1.8,Math.min(1.8,g.vy*.6)),last=performance.now();
   function tick(now){
    const dt=Math.min(40,now-last);last=now;const x=glide(vx,dt),y=glide(vy,dt),left=view.scrollLeft,top=view.scrollTop;
    view.scrollLeft+=x.distance;view.scrollTop+=y.distance;
    vx=Math.abs(view.scrollLeft-left)<.5?0:x.velocity;vy=Math.abs(view.scrollTop-top)<.5?0:y.velocity;
    if(Math.hypot(vx,vy)>.025)frame=requestAnimationFrame(tick);else frame=0;
   }
   frame=requestAnimationFrame(tick);
  }
  function click(e){if(blockClick){blockClick=false;e.preventDefault();e.stopImmediatePropagation();}}
  function interrupt(){stop();finish();}
  window.addEventListener('pointerdown',down,true);window.addEventListener('pointermove',move,{capture:true,passive:false});window.addEventListener('pointerup',up,true);window.addEventListener('pointercancel',up,true);
  view.addEventListener('click',click,true);view.addEventListener('wheel',interrupt,{passive:true});window.addEventListener('keydown',interrupt);window.addEventListener('blur',interrupt);
  return()=>{stop();finish();view.classList.remove('pan-enabled');window.removeEventListener('pointerdown',down,true);window.removeEventListener('pointermove',move,true);window.removeEventListener('pointerup',up,true);window.removeEventListener('pointercancel',up,true);view.removeEventListener('click',click,true);view.removeEventListener('wheel',interrupt);window.removeEventListener('keydown',interrupt);window.removeEventListener('blur',interrupt);};
}
