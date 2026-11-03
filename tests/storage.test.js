import test from 'node:test';import assert from 'node:assert/strict';
import {saveWorkspace,loadWorkspace,clearWorkspace} from '../src/rom-storage.js';
// In-memory IndexedDB contract double: tests serialization/ordering/error handling,
// not browser disk persistence or quota behavior.
const records=new Map();let failNext=false;
globalThis.indexedDB={open(){const request={};queueMicrotask(()=>{if(failNext){failNext=false;request.error=new Error('quota');request.onerror();return;}request.result={close(){},transaction(){const tx={};tx.objectStore=()=>{const invoke=(fn)=>{const req={};queueMicrotask(()=>{req.result=structuredClone(fn());req.onsuccess();tx.oncomplete();});return req;};return {put:(v,k)=>invoke(()=>records.set(k,structuredClone(v))),get:k=>invoke(()=>records.get(k)),delete:k=>invoke(()=>records.delete(k))};};return tx;}};request.onsuccess();});return request;}};
test('本地记录保存、载入、清除及失败后重试',async()=>{
 const bytes=new Uint8Array([1,2]);const first=saveWorkspace({filename:'one.bin',bytes,hasEdits:true});bytes[0]=99;await first;
 assert.equal((await loadWorkspace()).bytes[0],1);
 await Promise.all([saveWorkspace({filename:'two.bin',bytes:new Uint8Array([3])}),saveWorkspace({filename:'three.bin',bytes:new Uint8Array([4])})]);
 assert.equal((await loadWorkspace()).filename,'three.bin');failNext=true;await assert.rejects(saveWorkspace({filename:'failed.bin',bytes:new Uint8Array([0])}));
 await saveWorkspace({filename:'recovered.bin',bytes:new Uint8Array([8])});assert.equal((await loadWorkspace()).filename,'recovered.bin');
 await clearWorkspace();assert.equal(await loadWorkspace(),undefined);
});
