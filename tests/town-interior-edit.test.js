import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {townEditSnapshot,makeTownInteriorPatches} from '../src/rom/town-edit.js';
import {RomDocument} from '../src/rom/document.js';
import {loadTownArt} from '../src/rom/town-art.js';
// Small synthetic town-table fixture, no copyrighted graphics or full ROM in CI.
function fixture(){const b=new Uint8Array(0x110000),w=(p,v)=>{b[p]=v>>>8;b[p+1]=v&255;},l=(p,v)=>{w(p,v>>>16);w(p+2,v&65535);};l(0x2bcf2,0x7620c);
 for(let id=0;id<17;id++){const base=Math.floor(id/10)*123+(id%10)*4+1;w(0x761c6+id*2,base);w(0xd30da+id*8+4,base);b[0xd30da+id*8+6]=1;b[0xd30da+id*8+7]=1;for(let y=0;y<3;y++)for(let x=0;x<4;x++)w(0x764a8+(base+y*41+x)*2,522+id*12+y*4+x);}
 b.fill(80,0xcc22e,0xcc22e+204*64);for(let i=0;i<90;i++)w(0x7620c+i*6+2,0xffff);
 const at=(x,y)=>0xcc22e+(Math.floor(y/8)*4+Math.floor(x/8))*64+(y%8)*8+x%8;b[at(1,0)]=105;
 for(let kind=0;kind<5;kind++){const x=4+kind*5,y=5;for(let dy=0;dy<2;dy++)for(let dx=0;dx<2;dx++)b[at(x+dx,y+dy)]=[14,15,16,94][dy*2+dx];const p=0x7620c+kind*6;b[p]=kind;const doorX=x+(kind===1?0:1);w(p+2,1+Math.floor((y+1)/8)*41+Math.floor(doorX/8));b[p+4]=doorX%8;b[p+5]=(y+1)%8;}
 return b;
}
const apply=(b,r)=>{const out=b.slice();for(const p of r.patches)out[p.offset]=p.after;return out;};
test('complete facility crosses sector boundary and door records follow atomically',()=>{const b=fixture(),m=townEditSnapshot(b,0),f=m.facilities[0],r=makeTownInteriorPatches(b,0,{action:'move',rect:f,x:7,y:10}),after=townEditSnapshot(apply(b,r),0);assert.deepEqual(after.facilities[0].door,{x:8,y:11});assert.equal(after.cells[11*32+8],94);assert.equal(after.cells[5*32+4],80);assert.equal(townEditSnapshot(apply(b,r),1).cells[0],80);assert.deepEqual(b,fixture());});
test('reject split buildings, collisions, protected entry/exit and obstructed routes',()=>{const b=fixture();for(const draft of [{action:'move',rect:{x:4,y:5,width:1,height:1},x:7,y:10},{action:'move',rect:{x:4,y:5,width:2,height:2},x:9,y:5},{action:'move',rect:{x:1,y:0,width:1,height:1},x:7,y:10},{action:'paint',rect:{x:1,y:1,width:1,height:1},code:68},{action:'paint',rect:{x:0,y:2,width:32,height:1},code:68}])assert.throws(()=>makeTownInteriorPatches(b,0,draft));});
test('terrain painting rejects buildings and unknown codes, validates bounds',()=>{const b=fixture();for(const draft of [{action:'paint',rect:{x:4,y:5,width:1,height:1},code:80},{action:'paint',rect:{x:2,y:2,width:1,height:1},code:94},{action:'paint',rect:{x:31,y:23,width:2,height:1},code:80}])assert.throws(()=>makeTownInteriorPatches(b,0,draft));const r=makeTownInteriorPatches(b,0,{action:'paint',rect:{x:2,y:2,width:2,height:2},code:81});assert.equal(r.patches.length,4);});
const path=process.env.TAIKOU_RELEASE_ROM;
test('actual release all30 towns read; moved facility/terrain export reload undo redo preserves routes and code',{skip:!path},()=>{const b=new Uint8Array(fs.readFileSync(path)),d=new RomDocument(b,'arbitrary-future-release.bin','');for(let id=0;id<30;id++){const m=d.townInteriorSnapshot(id);assert.ok(m.facilities.length>=5);assert.equal(m.offsets.length,768);}
 const m=d.townInteriorSnapshot(29),f=m.facilities[0];let draft;for(let y=2;y<21&&!draft;y++)for(let x=1;x<29&&!draft;x++){try{const p={action:'move',rect:f,x,y};if(makeTownInteriorPatches(b,29,p).patches.length)draft=p;}catch{}}
 assert.ok(draft);assert.equal(d.applyTownInterior(29,draft),true);assert.throws(()=>d.applyTownInterior(29,draft,0),e=>e.code==='STALE_DRAFT');const changed=d.workingBytes,allowed=new Set([...m.offsets,...m.facilities.flatMap(f=>[2,3,4,5].map(i=>f.offset+i))]);for(let i=0;i<b.length;i++)if(b[i]!==changed[i])assert.ok(allowed.has(i),`unexpected changed ${i.toString(16)}`);
 const exported=d.exportBytes(),reload=new RomDocument(exported,'reload.bin','');assert.equal(reload.townInteriorSnapshot(29).facilities[0].door.x,draft.x+1);d.undo();assert.deepEqual(d.workingBytes,b);d.redo();assert.deepEqual(d.workingBytes,changed);d.setWriteGuard(()=>false);assert.throws(()=>d.applyTownInterior(29,{action:'paint',rect:{x:0,y:0,width:1,height:1},code:80}),e=>e.code==='READ_ONLY_MODE');for(const s of [0,1,2,3])for(let code=0;code<106;code++)assert.equal(loadTownArt(b,s).tile(code).length,1024);
});
