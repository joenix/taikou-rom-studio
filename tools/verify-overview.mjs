// Real-ROM integration checks; no copyrighted fixture is committed.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {RomDocument} from '../src/rom/document.js';
import {readOverview,overviewPatches} from '../src/rom/overview.js';
import {validateRom} from '../src/rom/validate.js';
const input=process.argv[2],output=process.argv[3];
if(!input||!output)throw Error('Usage: node tools/verify-overview.mjs INPUT.bin INTERNAL_OUTPUT.bin');
const bytes=new Uint8Array(fs.readFileSync(input)),doc=new RomDocument(bytes,'overview.bin','integration'),m=doc.overviewSnapshot(),d=m.descriptor;
const failCode=(fn,code)=>assert.throws(fn,e=>e.code===code);
doc.setWriteGuard(()=>false);failCode(()=>doc.applyOverview([{x:0,y:0,color:4}]),'READ_ONLY_MODE');doc.setWriteGuard(()=>true);
failCode(()=>doc.applyRecord('items',0,{value:1}),'READ_ONLY_RESOURCE');
let protectedPoint;for(let y=0;y<224&&!protectedPoint;y++)for(let x=0;x<128;x++)if(m.protectedPixel(x,y)){protectedPoint={x,y,color:4};break;}
for(const c of [{x:128,y:0,color:4},protectedPoint])failCode(()=>doc.applyOverview([c]),'PROTECTED_OVERVIEW');
assert.equal(doc.changedBytes,0);
assert(doc.applyOverview([{x:0,y:0,color:4},{x:1,y:0,color:4},{x:2,y:0,color:4},{x:3,y:0,color:4}]));
failCode(()=>doc.applyOverview([{x:4,y:0,color:4}],0),'STALE_DRAFT');
assert.equal(doc.overviewSnapshot().pixels[0],4);const painted=doc.workingBytes;
doc.undo();assert.deepEqual(doc.workingBytes,bytes);doc.redo();assert.deepEqual(doc.workingBytes,painted);
const exported=doc.exportBytes();assert(validateRom(exported).checksumMatches);assert.equal(readOverview(exported).pixels[0],4);
assert.deepEqual(doc.originalBytes,bytes);assert.deepEqual(new Uint8Array(fs.readFileSync(input)),bytes);
// All changed bytes belong only to private patterns and west display caches.
const allowed=at=>at>=d.pattern_bank_offset&&at<d.pattern_bank_offset+d.pattern_ids.length*32||[d.image_offset,d.page_offsets[0],d.stripe_offsets[0]].some((base,j)=>{const row=Math.floor((at-base)/(j===0?160:j===1?128:32)),col=(at-base)%(j===0?160:j===1?128:32);return row>=0&&row<28&&col>=0&&col<32;});
for(let i=0;i<bytes.length;i++)if(bytes[i]!==painted[i])assert(allowed(i),`Unrelated write ${i.toString(16)}`);
const reopened=new RomDocument(exported,'reopened.bin','integration',bytes);assert(reopened.restoreOverview({x0:0,y0:0,x1:3,y1:0}));assert.deepEqual(reopened.overviewSnapshot().pixels,m.pixels);reopened.undo();assert.equal(reopened.overviewSnapshot().pixels[0],4);
// Capacity failure must not partially commit a large stroke.
const many=[];let index=1;
for(let ty=0;ty<28;ty++)for(let tx=0;tx<16;tx++){
 let safe=true;for(let y=0;y<8;y++)for(let x=0;x<8;x++)if(m.protectedPixel(tx*8+x,ty*8+y))safe=false;
 if(!safe)continue;let n=index++;
 for(let i=0;i<64;i++){many.push({x:tx*8+i%8,y:ty*8+(i>>3),color:i<16?((n>>i)&1?6:4):4});}
}
failCode(()=>doc.applyOverview(many),'OVERVIEW_PATTERN_LIMIT');assert.deepEqual(doc.workingBytes,painted);
const invalid=bytes.slice();invalid[d.image_offset]=0;invalid[d.image_offset+1]=1;failCode(()=>readOverview(invalid),'INVALID_OVERVIEW');
fs.writeFileSync(output,exported);
console.log(JSON.stringify({status:'PASS',capacity:m.capacity,checks:['write guard','resource policy','protected road/city/original','stale draft','undo/redo exact bytes','checksum/reload','display cache scope','imported baseline restore','atomic capacity failure','unknown pattern rejection'],output}));
