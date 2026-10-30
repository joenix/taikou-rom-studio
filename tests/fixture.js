import {PROFILE} from '../src/rom/profile.js';
import {checksum} from '../src/rom/codec.js';
export function fixture(){
 const bytes=new Uint8Array(0x140000);
 const set=(offset,text)=>bytes.set(new TextEncoder().encode(text),offset);
 const word=(offset,value)=>{bytes[offset]=value>>>8;bytes[offset+1]=value&255;};
 set(0x100,'SEGA MEGA DRIVE ');bytes.set(Uint8Array.from('91be8d7d97a78e559360'.match(/../g),v=>parseInt(v,16)),0x120);
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
