import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {RomDocument} from '../src/rom/document.js';import{buildRoadFlowTables,installRoadFlowTables}from'../src/rom/road-flow-build.js';import{readRoadFlow}from'../src/rom/road-flow.js';import{worldNavigationDirty}from'../src/rom/west-navigation.js';import{westCoordinate}from'../src/rom/west-map.js';
const path=process.env.TAIKOU_RELEASE_ROM;
test('browser compiler exactly reproduces original C++ tables and relocates only owned runtime operands',{skip:!path},()=>{
 const b=new Uint8Array(fs.readFileSync(path)),r=readRoadFlow(b),built=buildRoadFlowTables(b);assert.deepEqual(new Uint8Array(Buffer.concat(built.parts)),b.slice(r.offset,r.code_offset));const out=installRoadFlowTables(b,built),next=readRoadFlow(out);assert.equal(next.entry,r.entry);assert.equal(next.editor_tables.length,r.code_offset-r.offset);assert.deepEqual(out.slice(next.symbols.RF_ATLAS,next.symbols.RF_ATLAS+next.editor_tables.length),b.slice(r.offset,r.code_offset));
});
test('terrain edits rebuild both navigation layers, survive reimport, and reuse their reserved slot',{skip:!path},async()=>{
 const b=new Uint8Array(fs.readFileSync(path)),d=new RomDocument(b,'map.bin','');d.applyMap('map-terrain',0,{cells:[{x:99,y:131,code:24},{x:100,y:131,code:44}]});assert.throws(()=>d.exportBytes(),e=>e.code==='ASYNC_ROAD_BUILD_REQUIRED');let progress=0;const out=await d.exportBytesAsync(({done})=>progress=done);assert.equal(progress,d.roadRouting.goal_count);const re=new RomDocument(out,'edited-map.bin','');assert.equal(worldNavigationDirty(out),false);assert.equal(out[westCoordinate(out,99,131).offset],24);assert.equal(out[westCoordinate(out,100,131).offset],44);assert.deepEqual(re.exportBytes(),out);assert.notDeepEqual(out.slice(re.roadRouting.symbols.RF_ATLAS,re.roadRouting.symbols.RF_PAGES),b.slice(d.roadRouting.symbols.RF_ATLAS,d.roadRouting.symbols.RF_PAGES));
 re.applyMap('map-terrain',0,{cells:[{x:99,y:131,code:54}]});const twice=await re.exportBytesAsync();assert.equal(twice.length,out.length);assert.equal(worldNavigationDirty(twice),false);
 const reload=new RomDocument(twice,'twice.bin','');assert.equal(reload.workingBytes[westCoordinate(twice,99,131).offset],54);
 d.undo();assert.deepEqual(d.workingBytes,b);assert.deepEqual(d.exportBytes(),b);d.redo();assert.equal(d.changedBytes,2);
 assert.throws(()=>d.applyMap('map-terrain',0,{cells:[{x:102,y:132,code:53}]}),e=>e.code==='PROTECTED_LOCATION_CELL');
});
