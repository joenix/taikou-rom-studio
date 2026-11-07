import test from 'node:test';
import assert from 'node:assert/strict';
import {fixture} from './fixture.js';
import {readAppearance,verifyAppearance} from '../src/rom/appearance.js';
import {RomDocument} from '../src/rom/document.js';
import {checksum} from '../src/rom/codec.js';
async function marked(){
 const old=fixture(),start=old.length,length=32+90+713*8,b=new Uint8Array(start+length+48),v=new DataView(b.buffer),encoder=new TextEncoder();b.set(old);
 b.set(encoder.encode('TKAM6001'),start);v.setUint16(start+8,1);v.setUint16(start+10,713);v.setUint16(start+12,600);v.setUint16(start+14,241);v.setUint32(start+16,8);v.setUint32(start+20,90);v.setUint32(start+24,713*8);
 for(let id=0;id<713;id++){const p=start+122+id*8;v.setUint16(p,1530+id%30);b[p+2]=1;v.setUint16(p+4,1560);b[p+6]=5;}
 const f=start+length;b.set(encoder.encode('TKAMEND1'),f);v.setUint32(f+8,start);v.setUint32(f+12,length);b.set(new Uint8Array(await crypto.subtle.digest('SHA-256',b.subarray(start,f))),f+16);v.setUint16(0x18e,checksum(b));return b;
}
test('missing dates remain unknown instead of invented years',async()=>{assert.equal(readAppearance(fixture()),null);const d=await RomDocument.load(fixture());assert.equal(d.readPerson(0).birthYear,null);});
test('load embedded dates by global ID, preserving source bytes',async()=>{const b=await marked(),before=b.slice(),d=await RomDocument.load(b);assert.equal(d.readPerson(0).birthYear,1530);assert.equal(d.readPerson(712).birthYear,1552);assert.deepEqual(b,before);});
test('reject malformed locator and modified date payload',async()=>{const b=await marked();b[b.length-40]=255;assert.throws(()=>readAppearance(b));const c=await marked();c[c.length-48-8]^=1;await assert.rejects(verifyAppearance(c));});
