// Read-only input; exercises export/reload entirely in memory. No released ROM is written.
import fs from 'node:fs';import crypto from 'node:crypto';import assert from 'node:assert/strict';
import {RomDocument} from '../src/rom/document.js';
const path=process.argv[2];if(!path)throw new Error('Usage: node tools/verify-editor-roundtrip.mjs /absolute/path/latest.bin');
const original=new Uint8Array(fs.readFileSync(path)),hash=b=>crypto.createHash('sha256').update(b).digest('hex'),before=hash(original),d=new RomDocument(original,'read-only-source','');
const person=d.readPerson(0),attrs=[...person.attrs];attrs[4]=attrs[4]===255?254:attrs[4]+1;const selector=d.readPerson(2).selector;
d.applyRecord('people',0,{attrs,portraitSelector:selector});
const item=d.readItem(0),value=item.value===255?254:item.value+1,icon=(item.iconSelector+1)%20;
d.applyRecord('items',0,{value,iconSelector:icon});
const map=d.mapSnapshot(),index=map.cells.findIndex(n=>n>=0&&n<64),x=index%328,y=Math.floor(index/328),code=map.cells[index]===19?53:19;
d.applyMap('map-terrain',0,{x0:x,y0:y,x1:x,y1:y,code});
const output=d.exportBytes(),reload=new RomDocument(output,'memory-only-roundtrip','');
assert.deepEqual(reload.readPerson(0).attrs,attrs);assert.equal(reload.readPerson(0).selector,selector);assert.equal(reload.readItem(0).value,value);assert.equal(reload.readItem(0).iconSelector,icon);assert.equal(reload.mapSnapshot().cells[index],code);assert.equal(hash(original),before);assert.equal(hash(fs.readFileSync(path)),before);
console.log(JSON.stringify({status:'PASS',input_sha256:before,people_attributes_and_portrait:true,item_value_and_icon:true,map_cell_write:true,export_reload_checksum_valid:reload.validation.checksumMatches,original_unchanged:true,scope:'memory-only export/reload; no new release, no full gameplay test'},null,2));
