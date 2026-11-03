// ROM data stays in this browser's IndexedDB. No network upload.
const DB='taikou-rom-studio', STORE='workspace';
let queue=Promise.resolve();
function open(){return new Promise((resolve,reject)=>{const request=indexedDB.open(DB,1);request.onupgradeneeded=()=>request.result.createObjectStore(STORE);request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);});}
async function operation(mode,action){const db=await open();try{return await new Promise((resolve,reject)=>{const tx=db.transaction(STORE,mode);let result;const req=action(tx.objectStore(STORE));req.onsuccess=()=>{result=req.result;};tx.oncomplete=()=>resolve(result);tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error||new Error('本地保存事务中断'));});}finally{db.close();}}
export function saveWorkspace(record){const copy={...record,bytes:record.bytes.slice()};queue=queue.catch(()=>{}).then(()=>operation('readwrite',s=>s.put(copy,'current')));return queue;}
export function loadWorkspace(){return queue.catch(()=>{}).then(()=>operation('readonly',s=>s.get('current')));}
export function clearWorkspace(){queue=queue.catch(()=>{}).then(()=>operation('readwrite',s=>s.delete('current')));return queue;}
