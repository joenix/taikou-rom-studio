import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {readRomDirectory} from '../src/rom/rom-directory.js';
import {verifyRuntimeResources} from '../src/rom/resource-contracts.js';
import {verifyEditorCompatibility} from '../tools/check-rom-compatibility.mjs';
import {RomDocument} from '../src/rom/document.js';
import {residentBindings} from '../src/rom/new-officers.js';
const path=process.env.TAIKOU_RELEASE_ROM;
// These contract checks also run in CI without distributing a game ROM.
const resourceFixture=()=>({payloadOffset:0x10000,manifest:{resources:{
 road_flow:{code_offset:0x2000,code_bytes:0x1000,goal_count:188},
 army_navigation:{schema:'world.army-navigation.v1',world_only:true,standard_destinations:188,npc_remote_steps:8,entry:0x2000,fill_buffer_entry:0x2002,visible_buffer_entry:0x2004,remote_entry:0x2006,sprite_entry:0x2008,water_query:0x200a,ui_work_base:0x20e000,ui_work_size:16},
 warship_sprites:{schema:'world.warship-sprites.v1',offset:0x4000,length:2048,width:32,height:32,count:4,stride:512,palette:0,vram_first_tile:0x6a0,vram_tiles:64},
 personal_boat_sprites:{schema:'world.personal-boat-sprites.v2',offset:0x4800,length:1536,width:16,height:24,count:4,stride:384,palette:0}
}}});
test('runtime contracts resolve declared locations without a release name',()=>{
 const d=resourceFixture(),b=new Uint8Array(0x11000),r=verifyRuntimeResources(b,d);
 assert.equal(r.army_navigation.mode,'validated-readonly');assert.equal(r.personal_boat_sprites.length,1536);
 d.manifest.resources.warship_sprites.offset=0x6000;
 assert.equal(verifyRuntimeResources(b,d).warship_sprites.offset,0x6000);
});
test('runtime contracts reject malformed known ship and navigation declarations',()=>{
 const b=new Uint8Array(0x11000);
 for(const change of [r=>r.army_navigation.sprite_entry=0x3000,r=>r.army_navigation.entry=0x2001,r=>r.personal_boat_sprites.stride=192,r=>r.warship_sprites.vram_first_tile=2040,r=>r.warship_sprites.length=0x10000]){
  const d=resourceFixture();change(d.manifest.resources);
  assert.throws(()=>verifyRuntimeResources(b,d),e=>e.code==='INVALID_RUNTIME_RESOURCE');
 }
});
test('unknown optional ship formats remain preserved with checked bounds',()=>{
 const d=resourceFixture(),b=new Uint8Array(0x11000);d.manifest.resources.warship_sprites.schema='world.warship-sprites.v999';
 assert.equal(verifyRuntimeResources(b,d).warship_sprites.mode,'preserved-unknown');
 d.manifest.resources.warship_sprites.offset=0xffff;
 assert.throws(()=>verifyRuntimeResources(b,d),e=>e.code==='INVALID_RUNTIME_RESOURCE');
});
test('supplied release exports without changing army code, ships or routes',{skip:!path},async()=>{
 const r=await verifyEditorCompatibility(new Uint8Array(fs.readFileSync(path)),'arbitrary-next-version.bin');
 assert.equal(r.people,713);assert.equal(r.new_officers,41);assert.equal(r.runtime_resources.army_navigation.mode,'validated-readonly');assert.ok(r.protected_resource_sha256.warship_sprites);assert.ok(r.overview_edit_export_reload_undo_redo);
});
test('native resident bindings show actual Chosokabe members and initial affiliations',{skip:!path},async()=>{
 const b=new Uint8Array(fs.readFileSync(path)),d=await RomDocument.load(b),s=d.snapshot(),f=s.factions.filter(f=>f.id===20);
 assert.equal(f.length,1);assert.equal(f[0].runtimeIntegrated,true);assert.deepEqual(f[0].members.map(p=>p.id).sort((a,b)=>a-b),[302,489,571]);
 assert.equal(s.people[302].factionId,20);assert.equal(s.people[302].castleId,129);assert.equal(s.people[571].rank,8);assert.equal(s.people[302].castleName,'岡豊城');
 assert.equal(s.factions.filter(f=>f.runtimeIntegrated).reduce((n,f)=>n+f.members.length,0),41);assert.deepEqual(d.exportBytes(),b);
 const broken=b.slice(),r=d.directory.manifest.resources.resident_sources;broken[r.offset+13]=255;
 assert.throws(()=>residentBindings(broken,d.directory),e=>e.code==='INVALID_RESIDENT_BINDINGS');
});
test('known resource schemas reject damaged ranges while future ship schema stays preserved',{skip:!path},()=>{
 const b=new Uint8Array(fs.readFileSync(path)),d=readRomDirectory(b),bad=structuredClone(d);bad.manifest.resources.army_navigation.sprite_entry=b.length+4;
 assert.throws(()=>verifyRuntimeResources(b,bad),e=>e.code==='INVALID_RUNTIME_RESOURCE');
 const next=structuredClone(d);next.manifest.resources.warship_sprites.schema='world.warship-sprites.v999';assert.equal(verifyRuntimeResources(b,next).warship_sprites.mode,'preserved-unknown');
 next.manifest.resources.warship_sprites.length=b.length;assert.throws(()=>verifyRuntimeResources(b,next),e=>e.code==='INVALID_RUNTIME_RESOURCE');
});
