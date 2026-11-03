import {PROFILE,RELEASE} from '../src/rom/profile.js';
import {checksum} from '../src/rom/codec.js';
export function fixture(){
 const bytes=new Uint8Array(RELEASE.size);
 const set=(offset,text)=>bytes.set(new TextEncoder().encode(text),offset);
 const word=(offset,value)=>{bytes[offset]=value>>>8;bytes[offset+1]=value&255;};
 bytes.set([0x20,0x7c,0,8,0x8f,0x3f,0x10,0x30,8,0],0x54e4c);
 set(0x100,'SEGA MEGA DRIVE ');set(0x120,RELEASE.title.padEnd(48,' '));set(0x150,RELEASE.title.padEnd(48,' '));
 for(const s of RELEASE.signatures)bytes.set(Buffer.from(s.hex,'hex'),s.offset);
 for(const s of PROFILE.signatures)bytes.set(Uint8Array.from(s.hex.match(/../g),v=>parseInt(v,16)),s.offset);
 for(let id=0;id<713;id++){
  const p=PROFILE.people.base+id*60,n=PROFILE.names.base+id*16;word(p,id);set(n+2,'A'+id);set(n+9,'B'+id);
  bytes[p+0x1a]=id%20;bytes[p+0x1b]=id%125;bytes[p+0x1c]=id%9;bytes[p+0x22]=10;bytes[p+0x26]=20;
  bytes.fill(50,p+0x27,p+0x2d);bytes[p+0x2d]=0x19;bytes[p+0x2e]=0x03;bytes[p+0x3b]=0xa7;
 }
 for(let id=0;id<300;id++){const p=PROFILE.items.base+id*14;set(p,'Item'+id);bytes[p+11]=200;bytes[p+12]=0x63;}
 for(let slot=0;slot<80;slot++){const p=PROFILE.instances.base+slot*4;word(p,slot);word(p+2,slot|0x8000);}
 for(let id=0;id<125;id++){const p=PROFILE.castles.base+id*20;set(p,'Castle'+id);bytes.fill(255,p+9,p+13);}
 word(0x18e,checksum(bytes));return bytes;
}
