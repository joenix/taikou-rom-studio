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
