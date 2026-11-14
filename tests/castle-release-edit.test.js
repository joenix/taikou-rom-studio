import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {RomDocument} from '../src/rom/document.js';import {CASTLE_FIELDS} from '../src/rom/domain-data.js';
const path=process.env.TAIKOU_RELEASE_ROM;
test('declared castle tables: original and extension records edit, export and undo without adjacent writes',{skip:!path},()=>{
 const b=new Uint8Array(fs.readFileSync(path)),d=new RomDocument(b,'no-version-name.bin',''),count=d.directory.manifest.resources.castle_visit_definitions.count;
 assert.equal(d.snapshot().castles.length,count);assert.deepEqual(d.readCastle(count-1).location,{x:102,y:132});assert.throws(()=>d.applyRecord('castles',count-1,{name:'城'}),e=>e.code==='UNSUPPORTED_FIELD');
 for(const id of [0,122,123,count-1]){
  const c=d.readCastle(id),draft={name:id<123?'城':c.name};for(const f of CASTLE_FIELDS)draft[f.key]=f.key==='size'?3:f.step;
  d.applyRecord('castles',id,draft);const out=d.exportBytes(),re=new RomDocument(out,'edited.bin','');assert.equal(re.readCastle(id).name,draft.name);
  for(const f of CASTLE_FIELDS)assert.equal(re.readCastle(id).state[f.key],draft[f.key]);
  const edited=d.workingBytes;for(let p=0;p<b.length;p++)if(edited[p]!==b[p])assert.ok(p>=c.offset&&p<c.offset+9||p>=c.state.offset+3&&p<=c.state.offset+15||id<123&&p>=0x77952+id*20&&p<0x77952+id*20+9,`unexpected write ${p.toString(16)}`);
  assert.equal(re.readCastle(id===count-1?id-1:id+1).state.funds,d.readCastle(id===count-1?id-1:id+1).state.funds);
  d.undo();assert.deepEqual(d.workingBytes,b);d.redo();assert.equal(d.readCastle(id).state.size,3);d.undo();
 }
 d.setWriteGuard(()=>false);assert.throws(()=>d.applyRecord('castles',0,{funds:10}),e=>e.code==='READ_ONLY_MODE');d.setWriteGuard(()=>true);
 assert.throws(()=>d.applyRecord('people',0,{affinity:1}),e=>e.code==='READ_ONLY_RESOURCE');
 assert.throws(()=>d.applyMap('map-castle',0,{x:1,y:1}),e=>['READ_ONLY_RESOURCE','ROAD_FLOW_REBUILD_REQUIRED'].includes(e.code));assert.deepEqual(d.workingBytes,b);
});
