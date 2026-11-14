import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {RomDocument}from'../src/rom/document.js';import {makeTownInteriorPatches}from'../src/rom/town-edit.js';import {loadTownArt}from'../src/rom/town-art.js';import{readRomDirectory}from'../src/rom/rom-directory.js';
const path=process.env.TAIKOU_RELEASE_ROM;
test('declared port profile and specialist doors survive full building moves, export and undo',{skip:!path},t=>{
 const b=new Uint8Array(fs.readFileSync(path));if(!readRomDirectory(b)?.manifest.resources.town_residents){t.skip('ROM has no specialist extension');return;}
 const d=new RomDocument(b,'no-version-in-name.bin',''),m=d.townInteriorSnapshot(29);assert.equal(m.buildings.length,15);assert.equal(m.facilities.filter(f=>f.kind>=8).length,6);assert.notDeepEqual(loadTownArt(b,1,29).tile(68),loadTownArt(b,1,0).tile(68));assert.ok(!m.palette.paintable.includes(79));
 for(const resident of m.facilities.filter(f=>f.kind>=8)){
  const building=m.buildings.find(f=>f.door?.x===resident.door.x&&f.door?.y===resident.door.y);let draft;
  for(let y=1;y<22&&!draft;y++)for(let x=4;x<29&&!draft;x++){const q={action:'move',rect:building,x,y};try{if(makeTownInteriorPatches(b,29,q).patches.length)draft=q;}catch{}}
  assert.ok(draft,resident.name);d.applyTownInterior(29,draft);const reload=new RomDocument(d.exportBytes(),'reloaded.bin',''),f=reload.townInteriorSnapshot(29).facilities.find(f=>f.record===resident.record);assert.equal(f.door.x,resident.door.x+draft.x-building.x);assert.equal(f.door.y,resident.door.y+draft.y-building.y);d.undo();assert.deepEqual(d.workingBytes,b);
 }
});
test('new-town garden tiles paint, erase and export with independent door bindings intact',{skip:!path},t=>{
 const b=new Uint8Array(fs.readFileSync(path));if(!readRomDirectory(b)?.manifest.resources.town_residents){t.skip('ROM has no specialist extension');return;}
 for(const id of [17,29]){
  const d=new RomDocument(b,'garden.bin',''),before=d.townInteriorSnapshot(id),codes=id===29?[20,21,37,38,39,40,65,66,67,68,69,70,87,88]:[20,21,37,38,39,40,50,51,52,53,54,55,56,57];
  for(const code of codes){assert.ok(before.palette.decorations.some(v=>v.code===code));let draft;
   for(let y=1;y<23&&!draft;y++)for(let x=1;x<31&&!draft;x++){const q={action:'paint',rect:{x,y,width:1,height:1},code};try{if(makeTownInteriorPatches(b,id,q).patches.length)draft=q;}catch{}}
   assert.ok(draft,`tile${code} can be painted in town${id}`);d.applyTownInterior(id,draft);const m=new RomDocument(d.exportBytes(),'garden-export.bin','').townInteriorSnapshot(id);assert.equal(m.cells[draft.rect.y*32+draft.rect.x],code);assert.deepEqual(m.facilities,before.facilities);d.applyTownInterior(id,{...draft,code:80});d.undo();d.undo();assert.deepEqual(d.workingBytes,b);
  }
 }
 const d=new RomDocument(b,'garden.bin',''),m=d.townInteriorSnapshot(29),f=m.facilities[0];assert.throws(()=>d.applyTownInterior(29,{action:'paint',rect:{x:f.door.x,y:f.door.y+1,width:1,height:1},code:66}),e=>e.code==='TOWN_ROUTE_BLOCKED');
});
