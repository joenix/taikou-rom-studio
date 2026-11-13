// Release gate: read the supplied artifact, edit/export/reload in memory only.
import fs from 'node:fs';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
import {RomDocument} from '../src/rom/document.js';
const hash=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
export async function verifyEditorCompatibility(bytes,filename='game.bin'){
 const before=hash(bytes),d=await RomDocument.load(bytes,filename),snapshot=d.snapshot(),map=d.mapSnapshot();
 const roster=snapshot.people.filter(p=>p.isNewOfficer),integrated=snapshot.factions.filter(f=>f.runtimeIntegrated);
 if(d.residentBindings.size){
  assert.equal(new Set(snapshot.factions.map(f=>f.id)).size,snapshot.factions.length,'Duplicate faction rows');
  assert.equal(integrated.reduce((n,f)=>n+f.members.length,0),roster.length,'Incomplete runtime faction rosters');
  for(const f of integrated)assert.ok(f.members.every(p=>p.factionId===f.id&&p.castleName&&p.rankName),'Invalid runtime affiliation display');
 }
 assert.deepEqual(d.exportBytes(),bytes,'Unedited export must be byte-identical');
 const preserved={};
 const checkProtected=out=>{
  for(const [id,r] of Object.entries(d.directory.manifest.resources)){
   if(id==='faction_overview')continue;
   const length=r.length??(r.stride*r.count);
   if(Number.isSafeInteger(r.offset)&&Number.isSafeInteger(length)&&length>0){
    assert.deepEqual(out.slice(r.offset,r.offset+length),bytes.slice(r.offset,r.offset+length),`${id} changed during overview export`);
    preserved[id]=hash(out.slice(r.offset,r.offset+length));
   }
   if(id==='road_flow'&&Number.isSafeInteger(r.code_offset)&&Number.isSafeInteger(r.code_bytes))assert.deepEqual(out.slice(r.code_offset,r.code_offset+r.code_bytes),bytes.slice(r.code_offset,r.code_offset+r.code_bytes),`${id} code changed`);
  }
 };
 let overviewRoundtrip=false;
 if(d.overviewCapability.supported){
  const m=d.overviewSnapshot();let cell;
  for(let y=0;y<224&&!cell;y++)for(let x=0;x<128;x++)if(!m.protectedPixel(x,y)){cell={x,y,color:m.pixels[y*m.width+x]===1?2:1};break;}
  assert.ok(cell);assert.equal(d.applyOverview([cell]),true);const out=d.exportBytes();checkProtected(out);
  // Legacy hook descriptors cover mixed code/data bundles. Permit changes
  // only inside the declared overview surfaces; all other bytes stay exact.
  const g=m.descriptor,ranges=[[g.image_offset,4480],[g.pattern_bank_offset,g.pattern_ids.length*32],...g.page_offsets.map(p=>[p,3584]),...g.stripe_offsets.map(p=>[p,896]),[0x18e,2]];
  for(let i=0;i<bytes.length;i++)if(out[i]!==bytes[i])assert.ok(ranges.some(([p,n])=>i>=p&&i<p+n),`Unexpected export change at ${i.toString(16)}`);
  const reload=await RomDocument.load(out,'renamed-future-release.bin');assert.equal(reload.overviewSnapshot().pixels[cell.y*m.width+cell.x],cell.color);
  assert.equal(d.undo(),true);assert.deepEqual(d.exportBytes(),bytes);assert.equal(d.redo(),true);assert.deepEqual(d.exportBytes(),out);overviewRoundtrip=true;
 }else checkProtected(d.exportBytes());
 assert.equal(hash(bytes),before);
 return {status:'PASS_EDITOR_DIRECTORY_CONTRACT_AND_EXPORT_PRESERVATION',rom_sha256:before,profile:d.directory.manifest.profile_id,directory_schema:d.directory.manifest.directory_schema,people:snapshot.people.length,new_officers:roster.length,resident_bindings_verified:d.residentBindings.size,integrated_faction_roster_count:integrated.length,castles:map.places.castles.length,towns:map.places.towns.length,runtime_resources:d.runtimeResources,unedited_export_identical:true,overview_edit_export_reload_undo_redo:overviewRoundtrip,protected_resource_sha256:preserved,version_filename_independent:true,source_unchanged:true,scope:'Actual supplied ROM loaded with the editor engine. Initial affiliations/ranks resolve from runtime bindings. Export and overview editing are memory-only; unknown runtime assets are preserved, not guessed or enabled for editing.'};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const [path,reportPath]=process.argv.slice(2);if(!path)throw new Error('Usage: node tools/check-rom-compatibility.mjs ROM [REPORT]');
 const bytes=new Uint8Array(fs.readFileSync(path)),result=await verifyEditorCompatibility(bytes);
 assert.equal(hash(fs.readFileSync(path)),result.rom_sha256);
 if(reportPath)fs.writeFileSync(reportPath,JSON.stringify(result,null,2)+'\n');
 console.log(JSON.stringify(result,null,2));
}
