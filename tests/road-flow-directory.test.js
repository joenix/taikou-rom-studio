import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {RomDocument} from '../src/rom/document.js';
import {readRoadFlow} from '../src/rom/road-flow.js';
import {readRomDirectory} from '../src/rom/rom-directory.js';
import {rebuildWestNavigation} from '../src/rom/west-navigation.js';
import {checksum} from '../src/rom/codec.js';

const file=new URL('../../taikou-rebuild/build/releases/v1.42.23/【小咪优化】MD太阁立志传_PRO_v1.42.23_道路优先.bin',import.meta.url);
const available=fs.existsSync(file),bytes=()=>new Uint8Array(fs.readFileSync(file));
test('directory-driven road-priority ROM opens159 castles,29 towns and713 people',{skip:!available},async()=>{
 const d=await RomDocument.load(bytes(),'latest.bin'),map=d.mapSnapshot();
 assert.equal(d.mapCapability.supported,true);assert.deepEqual([map.width,map.height,map.blocks,map.places.castles.length,map.places.towns.length],[616,368,1331,159,29]);
 assert.equal(d.snapshot().people.length,713);assert.equal(d.overviewCapability.supported,true);assert.equal(d.roadRouting.policy,'lexicographic-roads-first-v2');assert.equal(d.roadRouting.buffer_capacity,20);
 const roster=JSON.parse(fs.readFileSync(new URL('../../taikou-rebuild/assets/data/faction-native-batch-v142.json',import.meta.url),'utf8'));
 const actual=d.snapshot().people.filter(p=>p.isNewOfficer).map(p=>p.id).sort((a,b)=>a-b);
 assert.deepEqual(actual,roster.assignments.map(p=>p.person_id).sort((a,b)=>a-b));assert.equal(actual.length,41);
 const renamed=bytes();for(const at of [0x120,0x150])renamed.set(new TextEncoder().encode('TAIKOU PRO V1.42.99 FUTURE'.padEnd(48,' ')),at);
 const sum=checksum(renamed);renamed[0x18e]=sum>>>8;renamed[0x18f]=sum&255;
 assert.equal((await RomDocument.load(renamed,'future-title.bin')).mapSnapshot().places.castles.length,159);
});
test('overview edit/export preserves entire precompiled route resource and reloads',{skip:!available},async()=>{
 const before=bytes(),d=await RomDocument.load(before),m=d.overviewSnapshot(),r=d.roadRouting;let point;
 for(let y=0;y<224&&!point;y++)for(let x=0;x<128;x++)if(!m.protectedPixel(x,y)){point={x,y,color:m.pixels[y*640+x]===1?2:1};break;}
 assert.ok(point);assert.equal(d.applyOverview([point]),true);const out=d.exportBytes();assert.notDeepEqual(out,before);
 assert.deepEqual(out.slice(r.offset,r.offset+r.length),before.slice(r.offset,r.offset+r.length));assert.equal(readRoadFlow(out).entry,r.entry);
 const next=await RomDocument.load(out);assert.equal(next.overviewSnapshot().pixels[point.y*640+point.x],point.color);assert.equal(next.mapSnapshot().places.towns.length,29);
 assert.equal(d.undo(),true);assert.deepEqual(d.exportBytes(),before);assert.equal(d.redo(),true);assert.deepEqual(d.exportBytes(),out);
});
test('precompiled routes reject legacy rebuild and terrain writes atomically',{skip:!available},async()=>{
 const b=bytes(),d=await RomDocument.load(b);
 assert.throws(()=>rebuildWestNavigation(b),e=>e.code==='ROAD_FLOW_REBUILD_REQUIRED');
 assert.throws(()=>d.applyMap('map-terrain',0,{allowOriginal:true,cells:[{x:1,y:91,code:53}]}),e=>e.code==='ROAD_FLOW_REBUILD_REQUIRED');
 assert.deepEqual(d.workingBytes,b);assert.deepEqual(d.exportBytes(),b);
});
test('damaged route hooks and out-of-range directory references are rejected',{skip:!available},()=>{
 for(const at of [0xfa7e,0x10724]){const b=bytes();b[at]^=1;assert.throws(()=>readRoadFlow(b),e=>e.code==='INVALID_ROAD_FLOW');}
 for(const mutate of [r=>r.entry=0,r=>r.length+=2,r=>r.goal_count=999999,r=>r.symbols.RF_ROOTS+=2,r=>r.symbols.RF_PREVIOUS=0]){
  const b=bytes(),dir=structuredClone(readRomDirectory(b));mutate(dir.manifest.resources.road_flow);assert.throws(()=>readRoadFlow(b,dir),e=>e.code==='INVALID_ROAD_FLOW');
 }
});
