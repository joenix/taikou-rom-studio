import test from 'node:test';
import assert from 'node:assert/strict';
import {FEX142,factionExpansionLayout} from '../src/rom/fex-layout.js';
import {worldLayoutContract} from '../src/rom/world-layout-contract.js';
const fex=()=>({schema:'fex1.payload.v2',length:0xfe0,layout:{payloadSize:0xfe0,factionStart:0,factionCount:18,factionStride:34,castleStart:0xd40,castleCount:37,castleStride:18,oldToNewRelations:0x4ec,newToNewRelations:0x654,leaderIds:0x798,governorIds:0x420}});
test('legacy and directory-described FEX layouts keep separate record banks',()=>{
 assert.equal(factionExpansionLayout({schema:'fex1.payload.v1'}),FEX142);
 const l=factionExpansionLayout(fex());assert.equal(l.castleCount,37);assert.equal(l.castleStart+37*18,0xfda);
});
test('FEX rejects overlapping governors, overflowing IDs and inconsistent lengths',()=>{
 for(const mutate of [r=>r.layout.governorIds=r.layout.castleStart,r=>r.layout.castleCount=133,r=>r.length--,r=>r.layout.castleStart=0xfd0]){
  const r=fex();mutate(r);assert.throws(()=>factionExpansionLayout(r),{code:'INVALID_FEX142'});
 }
});
const contract=()=>({schema:'world.layout-contract.v1',towns:{entries:0x1000,bases:0x2000,names:0x3000,interiors:0x4000,town_count:30,entry_count:33,block_count:360,scene_index:0xa000,scene_index_rows:56},place_records:0xc000,place_count:50,operand_patches:[{offset:0x300,before:'001d',after:'001e'}]});
test('world tables and exact operand bytes resolve without a release-name exception',()=>{
 const b=new Uint8Array(0x20000);b[0x301]=30;const base={placeCount:48};const directory={payloadOffset:0x18000,manifest:{resources:{world_map:{contract:contract()}}}};
 const result=worldLayoutContract(b,base,directory);assert.equal(result.towns.town_count,30);assert.deepEqual(result.nativeTownIds,Array.from({length:13},(_,i)=>i+17));
 b[0x301]=29;assert.throws(()=>worldLayoutContract(b,base,directory),{code:'INVALID_WORLD_CONTRACT'});
});
test('world contract rejects truncated tables and duplicate mutable operands',()=>{
 const b=new Uint8Array(0x20000);b[0x301]=30;
 for(const mutate of [c=>c.towns.interiors=0x17000,c=>c.operand_patches.push(c.operand_patches[0]),c=>c.towns.block_count--]){
  const c=contract();mutate(c);assert.throws(()=>worldLayoutContract(b,{placeCount:48},{payloadOffset:0x18000,manifest:{resources:{world_map:{contract:c}}}}),{code:'INVALID_WORLD_CONTRACT'});
 }
});
