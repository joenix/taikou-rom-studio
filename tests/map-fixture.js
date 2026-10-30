import {fixture} from './fixture.js';
import {checksum} from '../src/rom/codec.js';
import {WORLD} from '../src/rom/world-map.js';
import {PROFILE} from '../src/rom/profile.js';
export function mapFixture(){
 const b=fixture(),word=(p,n)=>{b[p]=n>>>8;b[p+1]=n&255;},long=(p,n)=>{word(p,n>>>16);word(p+2,n&65535);};
 for(const [p,h]of [[0x17c22,'23fc000c082600ffb460'],[0xc0aa,'207c000764a8'],[0xf9a6,'227c000d30da'],[0xc284,'d7c00c44007b6daa'],[0x7484,'207c000761c6']])b.set(Buffer.from(h,'hex'),p);
 for(let i=0;i<521;i++)word(WORLD.indexBase+i*2,i+1);
 b.fill(19,WORLD.dataBase,WORLD.dataBase+521*64);
 for(let i=0;i<125;i++){const sector=i===123?79:i===124?91:i,p=PROFILE.castles.base+i*20;word(p+14,sector);b[p+16]=2;b[p+17]=2;b[WORLD.dataBase+sector*64+18]=128;b[WORLD.dataBase+sector*64+19]=136;}
 const bases=[0x3d8,0x3dc,0x3e0,0x3e4,0x3e8,0x3ec,0x3f0,0x3f4,0x3f8,0x3fc,0x453,0x457,0x45b,0x45f,0x463,0x467,0x46b];
 for(let id=0;id<17;id++){word(WORLD.townBases+id*2,bases[id]);const p=0x73000+id*8;long(WORLD.townPointers+id*4,p);b.set(Buffer.from('Town'+String(id).padStart(2,'0')),p);}
 for(let slot=0;slot<20;slot++){const id=slot<17?slot:[9,11,12][slot-17],sector=150+id,p=WORLD.townEntrances+slot*8,x=slot<17?2:3;word(p,sector);b[p+2]=x;b[p+3]=2;word(p+4,bases[id]+2);b[p+6]=1;b[p+7]=5;b[WORLD.dataBase+sector*64+16+x]=slot<17?64:66;}
 word(0x18e,checksum(b));return b;
}
