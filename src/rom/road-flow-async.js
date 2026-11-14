import {fail} from './codec.js';
export async function rebuildRoadFlowAsync(bytes,progress=()=>{}){
 if(typeof Worker==='undefined'){const {buildRoadFlowTables,installRoadFlowTables}=await import('./road-flow-build.js');return installRoadFlowTables(bytes,buildRoadFlowTables(bytes,progress));}
 return new Promise((resolve,reject)=>{
  const worker=new Worker(new URL('./road-flow-worker.js',import.meta.url),{type:'module'});
  const stop=()=>worker.terminate();
  worker.onmessage=({data})=>{if(data.progress){progress(data.progress);return;}stop();if(data.error){try{fail(data.error.code,data.error.message);}catch(e){reject(e);}}else resolve(data.bytes);};
  worker.onerror=()=>{stop();reject(new Error('寻路重建未完成，请重试；当前修改仍保留在编辑器中'));};
  const copy=bytes.slice();worker.postMessage({bytes:copy},[copy.buffer]);
 });
}
