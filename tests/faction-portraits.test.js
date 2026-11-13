import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {RomDocument} from '../src/rom/document.js';
import {portraitImage} from '../src/rom/portraits.js';

const rom=new URL('../../taikou-rebuild/build/releases/v1.42.26/【小咪优化】MD太阁立志传_PRO_v1.42.26_名将头像.bin',import.meta.url);
test('refreshed41 portraits load through current editor, distinct from all original faces',{skip:!fs.existsSync(rom)},async()=>{
 const b=new Uint8Array(fs.readFileSync(rom)),d=await RomDocument.load(b),people=d.snapshot().people;
 const roster=JSON.parse(fs.readFileSync(new URL('../../taikou-rebuild/assets/data/faction-portraits-v142.json',import.meta.url),'utf8')).assignments;
 const signature=selector=>{const im=portraitImage(b,selector);assert.deepEqual([im.width,im.height],[32,40]);return createHash('sha256').update(im.indices).update(JSON.stringify(im.colors)).digest('hex');};
 const used=new Set(people.filter(p=>!p.isNewOfficer).map(p=>signature(p.selector)));
 assert.equal(used.size,672);assert.equal(people.filter(p=>p.isNewOfficer).length,41);
 for(const r of roster){const person=d.readPerson(r.person_id);assert.ok(person.isNewOfficer);assert.equal(person.selector,r.selector);const sig=signature(person.selector);assert.ok(!used.has(sig),r.name);used.add(sig);}
 assert.equal(used.size,713);assert.deepEqual(d.exportBytes(),b);assert.equal(d.mapSnapshot().places.castles.length,159);assert.equal(d.roadRouting.policy,'lexicographic-roads-first-v2');
});
