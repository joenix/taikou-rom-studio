import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {RomDocument} from '../src/rom/document.js';
const path=process.env.TAIKOU_RELEASE_ROM;
test('current declared ROM: people, item and castle editing share UI/document capability and preserve unrelated records',{skip:!path},()=>{
 const b=new Uint8Array(fs.readFileSync(path)),d=new RomDocument(b,'no-release-in-name.bin','');
 for(const kind of ['people','items','castles','overview','town-interior'])assert.equal(d.canEditResource(kind),true,kind);
 assert.equal(d.canEditResource('map-terrain'),true);assert.equal(d.canEditResource('factions'),false);
 for(const id of [0,...d.newOfficerIds].slice(0,3)){
  const person=d.readPerson(id),attrs=person.attrs.map((n,i)=>i===0?(n+1)%256:n);
  d.applyRecord('people',id,{attrs,affinity:(person.affinity+1)%16});const re=new RomDocument(d.exportBytes(),'export.bin','');assert.deepEqual(re.readPerson(id).attrs,attrs);assert.deepEqual(re.readPerson(id===0?1:0).attrs,d.readPerson(id===0?1:0).attrs);d.undo();assert.deepEqual(d.workingBytes,b);d.redo();assert.deepEqual(d.readPerson(id).attrs,attrs);d.undo();
 }
 const p=d.readPerson(0),other=d.readPerson(1);d.applyRecord('people',0,{portraitSelector:other.selector});assert.equal(new RomDocument(d.exportBytes(),'portrait.bin','').readPerson(0).selector,other.selector);d.undo();assert.deepEqual(d.workingBytes,b);
 for(const id of [0,299]){const item=d.readItem(id),value=(item.value+1)%256;d.applyRecord('items',id,{value});assert.equal(new RomDocument(d.exportBytes(),'items.bin','').readItem(id).value,value);d.undo();assert.deepEqual(d.workingBytes,b);}
 d.setWriteGuard(()=>false);for(const kind of ['people','items','castles'])assert.throws(()=>d.applyRecord(kind,0,{}),e=>e.code==='READ_ONLY_MODE');assert.deepEqual(d.workingBytes,b);
});
