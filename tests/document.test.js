import test from 'node:test';
import assert from 'node:assert/strict';
import {RomDocument} from '../src/rom/document.js';
import {validateRom} from '../src/rom/validate.js';
import {PROFILE} from '../src/rom/profile.js';
import {checksum,u16} from '../src/rom/codec.js';
import {fixture} from './fixture.js';
const make=()=>new RomDocument(fixture(),'test.bin','test-hash');

test('完整表校验和读取数量，不把城池关联当成势力所有权',()=>{
 const d=make(),s=d.snapshot();assert.equal(s.people.length,713);assert.equal(s.items.length,300);assert.equal(s.castles.length,125);assert.equal(s.factions.length,20);assert.equal(d.validation.checksumMatches,true);assert.equal(s.people[0].skills[7],3);assert.equal(s.items[51].value,200);assert.equal(s.items[51].instances[0].ownerRaw,0x8033);
});
test('拒绝非太阁、结构损坏、数据越界和错误关键指令',()=>{
 for(const [mutate,code] of [[b=>b[0x100]=0,'NOT_MD_ROM'],[b=>b[0x120]=0,'NOT_TAIKOU'],[b=>b[PROFILE.people.base+20*60+1]=0,'RECORD_ID_MISMATCH'],[b=>b[0x54ff2]=0,'UNSUPPORTED_LAYOUT'],[b=>b[PROFILE.people.base+0x1b]=254,'INVALID_CASTLE'],[b=>b[PROFILE.instances.base]=255,'INVALID_ITEM_REFERENCE']]){
  const bytes=fixture();mutate(bytes);assert.throws(()=>validateRom(bytes),e=>e.code===code);
 }
 assert.throws(()=>validateRom(new Uint8Array(10)),e=>e.code==='INVALID_SIZE');
});
test('捕捉旧编辑器价格写坏保留字节的情况',()=>{
 const bytes=fixture();bytes[PROFILE.items.base+10]=1;assert.throws(()=>validateRom(bytes),e=>e.code==='ITEM_RESERVED_BYTE'&&e.details.offset===PROFILE.items.base+10);
});
test('宝物价值仅写 +11，不改名称尾部、分类、其他记录',()=>{
 const d=make(),before=d.workingBytes,p=PROFILE.items.base+51*14;d.applyRecord('items',51,{value:255});const after=d.workingBytes;
 assert.equal(after[p+11],255);assert.equal(after[p+10],0);assert.equal(after[p+12],before[p+12]);assert.deepEqual([...after.keys()].filter(i=>after[i]!==before[i]),[p+11]);assert.equal(d.history.length,1);
 assert.throws(()=>d.applyRecord('items',51,{value:256}),e=>e.code==='INVALID_FIELD');
});
test('单人多字段是一个事务，保持文化技能与相性高四位，原文件不变',()=>{
 const d=make(),original=d.originalBytes,p=PROFILE.people.base+60;const person=d.readPerson(1);
 d.applyRecord('people',1,{attrs:[0,1,100,150,200,255],skills:[3,3,3,3,3,3,3],affinity:15,family:'Oda',given:'Nobu'});
 assert.deepEqual(d.readPerson(1).attrs,[0,1,100,150,200,255]);assert.equal(d.workingBytes[p+0x2e]&3,person.skills[7]);assert.equal(d.workingBytes[p+0x3b]&0xf0,0xa0);assert.equal(d.history.length,1);assert.deepEqual(d.originalBytes,original);
 for(let id of [0,2,712])assert.deepEqual(d.readPerson(id),new RomDocument(original,'a','b').readPerson(id));
 assert.ok(d.undo());assert.deepEqual(d.workingBytes,original);assert.ok(d.redo());assert.equal(d.readPerson(1).attrs[5],255);
});
test('无效字符、名称过长、非法数值、跨资源字段和过期草稿全部原子拒绝',()=>{
 const d=make(),before=d.workingBytes;
 for(const [kind,id,draft,code] of [['people',0,{family:'😀'},'UNENCODABLE_TEXT'],['people',0,{family:'1234567'},'TEXT_TOO_LONG'],['people',0,{attrs:[1,2,3,4,5,-1]},'INVALID_FIELD'],['people',0,{family:'OK',attrs:[1,2,3,4,5,NaN]},'INVALID_FIELD'],['people',0,{rank:8},'UNSUPPORTED_FIELD'],['factions',0,{name:'test'},'READ_ONLY_RESOURCE']]){
  assert.throws(()=>d.applyRecord(kind,id,draft),e=>e.code===code);assert.deepEqual(d.workingBytes,before);
 }
 d.applyRecord('items',0,{value:1});assert.throws(()=>d.applyRecord('items',1,{value:2},0),e=>e.code==='STALE_DRAFT');
});
test('取消由 UI 管理，读取与空修改都不写数据；得到的字节副本不可篡改内部状态',()=>{
 const d=make();const copy=d.workingBytes;copy[0]=255;assert.equal(d.workingBytes[0],0);const p=d.readPerson(0);assert.equal(d.applyRecord('people',0,{family:p.family,attrs:p.attrs}),false);assert.equal(d.changedBytes,0);assert.equal(d.history.length,0);
});
test('导出只含记录变更与 MD 校验和，重载一致',async()=>{
 const d=make();d.applyRecord('items',2,{value:201});const exported=d.exportBytes();const original=d.originalBytes;
 assert.equal(exported.length,original.length);assert.equal(u16(exported,0x18e),checksum(exported));
 const allowed=new Set([0x18e,0x18f,PROFILE.items.base+2*14+11]);for(let i=0;i<exported.length;i++)if(exported[i]!==original[i])assert.ok(allowed.has(i));
 const reloaded=await RomDocument.load(exported,'edited.bin');assert.equal(reloaded.readItem(2).value,201);assert.equal(reloaded.validation.checksumMatches,true);assert.equal(d.originalBytes[PROFILE.items.base+2*14+11],200);
});
test('城名编辑保留其余结构，姓名保留给名前导字节',()=>{
 const d=make(),before=d.workingBytes;d.applyRecord('castles',3,{name:'New'});const p=PROFILE.castles.base+3*20;assert.deepEqual(d.workingBytes.slice(p+9,p+20),before.slice(p+9,p+20));
 d.applyRecord('people',0,{given:'Nobu'});assert.equal(d.workingBytes[PROFILE.names.base+8],0);assert.equal(d.readPerson(0).given,'Nobu');
});


test('导入时完整校验和失败即拒绝，编辑事务允许工作副本校验和待导出更新',async()=>{
 const bytes=fixture();bytes[PROFILE.people.base+0x27]=51;
 await assert.rejects(RomDocument.load(bytes,'bad.bin'),e=>e.code==='CHECKSUM_MISMATCH');
 const d=make();assert.equal(d.applyRecord('people',0,{attrs:[51,50,50,50,50,50]}),true);
 const reload=await RomDocument.load(d.exportBytes(),'export.bin');assert.equal(reload.validation.checksumMatches,true);
});
