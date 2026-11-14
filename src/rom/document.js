import {townEditSnapshot,makeTownInteriorPatches} from './town-edit.js';
import {verifyRuntimeResources} from './resource-contracts.js';
import {overviewCapability,readOverview,overviewPatches} from './overview.js';
import {isWestRom,worldLayoutSpec} from './west-layout.js';
import {rebuildWestNavigation,worldNavigationDirty} from './west-navigation.js';
import {readAppearance,verifyAppearance} from './appearance.js';
import {itemCategory} from './item-categories.js';
import {readCastleState,readFactionState,CASTLE_FIELDS,castleFieldBytes,CASTLE_STATE} from './domain-data.js';
import {readFactionExpansion,relationView,writeFactionExpansion} from './faction-expansion.js';
import {itemIconSelector,setItemIcon} from './item-icons.js';
import {validatePortraitSelector,portraitImage} from './portraits.js';
import {townEngineCapability,createIndependentTown,setTownActive,verifyTownEngine} from './town-engine.js';
import {readMapExtension} from './map-extension.js';
import {inspectWorldMap,readWorldMap,requireWorldMap,makeTerrainPatches,makePlacePatches,mapCoordinate} from './world-map.js';
import {PROFILE,STATS,SKILLS,RANKS,hex} from './profile.js';
import {validateRom} from './validate.js';
import {readRomDirectory} from './rom-directory.js';
import {residentBindings} from './new-officers.js';
import {readRoadFlow,requireExternalRoadRebuild} from './road-flow.js';
import {span,u16,decodeText,encodeField,integer,fail,checksum} from './codec.js';
export class RomDocument {
 #original;#bytes;#imported;#undo=[];#redo=[];#writeGuard=()=>true;
 setWriteGuard(guard){this.#writeGuard=guard;}
 #requireWrite(resource=null){if(this.editPolicy==='readonly-trial')fail('READ_ONLY_ROM','这份试玩 ROM 暂仅支持浏览，编辑导出尚未开放');if(resource?.startsWith('map-'))requireExternalRoadRebuild(this.#bytes);if(this.editPolicy==='overview-only'&&resource&&!['overview','town-interior'].includes(resource))fail('READ_ONLY_RESOURCE','当前 ROM 开放势力图与町内地图编辑');if(!this.#writeGuard())fail("READ_ONLY_MODE","当前设备或模式仅支持查看");}
 constructor(bytes,filename,sha256,importedBytes=bytes){
  this.validation=validateRom(bytes);this.directory=this.validation.directory||readRomDirectory(bytes);const ext=readMapExtension(bytes);if(ext){verifyTownEngine(bytes,ext);requireWorldMap(bytes);}this.#imported=new Uint8Array(importedBytes);this.#original=new Uint8Array(bytes);this.#bytes=new Uint8Array(bytes);
  this.runtimeResources=verifyRuntimeResources(bytes,this.directory);this.appearance=readAppearance(bytes);this.factionExpansion=readFactionExpansion(bytes,this.directory);this.residentBindings=residentBindings(bytes,this.directory);this.newOfficerIds=new Set(this.residentBindings.keys());this.filename=filename;this.sha256=sha256;this.revision=0;
 }
 static async load(buffer,filename='game.bin',importedBuffer=null){
  const bytes=buffer instanceof Uint8Array?buffer:new Uint8Array(buffer);
  validateRom(bytes);await verifyAppearance(bytes);
  const imported=importedBuffer===null?bytes:new Uint8Array(importedBuffer);validateRom(imported);if(worldLayoutSpec(bytes)?.version!==worldLayoutSpec(imported)?.version)fail('INVALID_RESTORE_BASELINE','还原基准与当前地图版本不匹配');
  const digest=await crypto.subtle.digest('SHA-256',bytes);
  return new RomDocument(bytes,filename,Array.from(new Uint8Array(digest),b=>b.toString(16).padStart(2,'0')).join(''),imported);
 }
 get byteLength(){return this.#bytes.length;}
 get roadRouting(){return readRoadFlow(this.#bytes);}
 get editPolicy(){return this.directory?.manifest?.build?.edit_policy||'editable';}
 get canUndo(){return this.#undo.length>0;}
 get canRedo(){return this.#redo.length>0;}
 get history(){return this.#undo.map(t=>({kind:t.kind,id:t.id,label:t.label,changes:t.patches.length}));}
 get changedBytes(){let n=Math.max(0,this.#original.length-this.#bytes.length);for(let i=0;i<this.#bytes.length;i++)if(this.#bytes[i]!==this.#original[i])n++;return n;}
 get importedBytes(){return new Uint8Array(this.#imported);}
 get originalBytes(){return new Uint8Array(this.#original);}
 get workingBytes(){return new Uint8Array(this.#bytes);}
 get mapCapability(){return inspectWorldMap(this.#bytes);}
 mapSnapshot(){return readWorldMap(this.#bytes);}
 applyMap(kind,id,draft,expectedRevision=this.revision){this.#requireWrite(kind);
  if(expectedRevision!==this.revision)fail('STALE_DRAFT','地图已变化，请重新打开编辑窗口');
  const result=kind==='map-terrain'?makeTerrainPatches(this.#bytes,draft):makePlacePatches(this.#bytes,kind,id,draft);
  if(!result.patches.length)return false;
  const candidate=new Uint8Array(this.#bytes);for(const patch of result.patches)candidate[patch.offset]=patch.after;
  validateRom(candidate,{verifyChecksum:false});requireWorldMap(candidate);const ext=readMapExtension(candidate);if(ext)verifyTownEngine(candidate,ext);
  this.#bytes=candidate;this.#undo.push({kind,id,label:result.label,patches:result.patches});this.#redo=[];this.revision++;return true;
 }
 restoreMapTerrain(draft,expectedRevision=this.revision){this.#requireWrite('map-terrain');
  if(expectedRevision!==this.revision)fail('STALE_DRAFT','地图已变化，请重新选择还原区域');
  const {x0,y0,x1=x0,y1=y0}=draft;for(const v of [x0,x1,y0,y1])if(!Number.isInteger(v))fail('INVALID_FIELD','选区坐标必须是整数');
  if((Math.abs(x1-x0)+1)*(Math.abs(y1-y0)+1)>4096)fail('MAP_SELECTION_TOO_LARGE','每次最多还原4096格');
  const cells=[];for(let y=Math.min(y0,y1);y<=Math.max(y0,y1);y++)for(let x=Math.min(x0,x1);x<=Math.max(x0,x1);x++){
   const base=mapCoordinate(this.#imported,x,y),current=mapCoordinate(this.#bytes,x,y),code=this.#imported[base.offset];if(code!==this.#bytes[current.offset])cells.push({x,y,code});
  }
  if(!cells.length)return false;
  const changed=this.applyMap('map-terrain',0,{cells,allowOriginal:draft.allowOriginal===true},expectedRevision);
  if(changed)this.#undo[this.#undo.length-1].label=`还原地图选区 · ${cells.length} 格`;return changed;
 }
 get overviewCapability(){return overviewCapability(this.#bytes);}
 overviewSnapshot(){return readOverview(this.#bytes);}
 applyOverview(cells,expectedRevision=this.revision){this.#requireWrite('overview');
  if(expectedRevision!==this.revision)fail('STALE_DRAFT','势力图已变化，请重新绘制');
  const patches=overviewPatches(this.#bytes,cells);if(!patches.length)return false;
  const candidate=this.#bytes.slice();for(const p of patches)candidate[p.offset]=p.after;
  readOverview(candidate);validateRom(candidate,{verifyChecksum:false});this.#bytes=candidate;
  this.#undo.push({kind:'overview',id:0,label:'势力图 · 本州西端绘制',patches});this.#redo=[];this.revision++;return true;
 }
 restoreOverview(rect,expectedRevision=this.revision){this.#requireWrite('overview');
  const base=readOverview(this.#imported),m=readOverview(this.#bytes),cells=[];
  for(const v of Object.values(rect))if(!Number.isInteger(v))fail('INVALID_OVERVIEW_EDIT','选区坐标必须为整数');
  const x0=Math.max(0,Math.min(rect.x0,rect.x1)),x1=Math.min(127,Math.max(rect.x0,rect.x1)),y0=Math.max(0,Math.min(rect.y0,rect.y1)),y1=Math.min(223,Math.max(rect.y0,rect.y1));
  for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++)if(!m.protectedPixel(x,y)&&m.pixels[y*640+x]!==base.pixels[y*640+x])cells.push({x,y,color:base.pixels[y*640+x]});
  return this.applyOverview(cells,expectedRevision);
 }
 townInteriorSnapshot(id){return townEditSnapshot(this.#bytes,id);}
 applyTownInterior(id,draft,expectedRevision=this.revision){this.#requireWrite('town-interior');
  if(expectedRevision!==this.revision)fail('STALE_DRAFT','町内地图已变化，请重新选择');
  const result=makeTownInteriorPatches(this.#bytes,id,draft);if(!result.patches.length)return false;
  const candidate=this.#bytes.slice();for(const p of result.patches)candidate[p.offset]=p.after;
  validateRom(candidate,{verifyChecksum:false});townEditSnapshot(candidate,id);
  this.#bytes=candidate;this.#undo.push({kind:'town-interior',id,label:result.label,patches:result.patches});this.#redo=[];this.revision++;return true;
 }
 get townCapability(){return isWestRom(this.#bytes)?{supported:false,error:{message:'当前扩展版支持浏览已有町，本阶段不新增町'}}:townEngineCapability(this.#bytes);}
 get mapExtension(){return readMapExtension(this.#bytes);}
 applyTown(action,draft,expectedRevision=this.revision){this.#requireWrite('town');
  if(expectedRevision!==this.revision)fail('STALE_DRAFT','地图已变化，请重新打开编辑窗口');
  const result=action==='create'?createIndependentTown(this.#bytes,draft):action==='disable'?setTownActive(this.#bytes,false,draft):action==='restore'?setTownActive(this.#bytes,true,draft):null;
  if(!result)fail('UNSUPPORTED_OPERATION','未支持的町操作');
  const candidate=result.bytes;validateRom(candidate,{verifyChecksum:false});requireWorldMap(candidate);verifyTownEngine(candidate,readMapExtension(candidate));
  const patches=[];for(let i=0;i<Math.max(this.#bytes.length,candidate.length);i++)if(this.#bytes[i]!==candidate[i])patches.push({offset:i,before:this.#bytes[i],after:candidate[i]});
  this.#undo.push({kind:'map-town',id:17,label:result.label,patches,beforeLength:this.#bytes.length,afterLength:candidate.length});this.#bytes=candidate;this.directory=readRomDirectory(candidate);this.factionExpansion=readFactionExpansion(candidate,this.directory);this.#redo=[];this.revision++;return true;
 }
 readPerson(id){
  integer(id,0,712,'武将 ID');const b=this.#bytes,p=PROFILE.people.base+id*60,n=PROFILE.names.base+id*16;
  const family=decodeText(b,n+2,6),given=decodeText(b,n+8,8),binding=this.residentBindings.get(id);const factionId=binding?.factionId??b[p+0x1a],castleId=binding?.castleId??b[p+0x1b],rank=binding?.rank??b[p+0x1c];
  return {id,family,given,name:family+' '+given,isNewOfficer:this.newOfficerIds.has(id),offset:p,nameOffset:n,birthYear:this.appearance?.records[id]?.birthYear??null,
   attrs:Array.from(span(b,p+0x27,6)),skills:SKILLS.map((_,i)=>(b[p+0x2d+Math.floor(i/4)]>>>(6-2*(i%4)))&3),
   factionId,castleId,rank,rankName:RANKS[rank],sourceAffiliation:binding?{factionId:b[p+0x1a],castleId:b[p+0x1b],rank:b[p+0x1c]}:null,
   strategyLevel:b[p+0x22],tacticsLevel:b[p+0x26],strategyXp:u16(b,p+0x20),tacticsXp:u16(b,p+0x24),affinity:b[p+0x3b]&15,
   portraitOffset:PROFILE.portraits.base+id*16,selector:u16(b,PROFILE.portraits.base+id*16),raw:Array.from(span(b,p,60))};
 }
 readItem(id){
  integer(id,0,299,'宝物 ID');const b=this.#bytes,p=PROFILE.items.base+id*14,meta=b[p+12];
  const category=meta&0xe0,classification=itemCategory(meta,b[p+13]);
  return {id,name:decodeText(b,p,10),value:b[p+11],category,categoryKey:classification.key,categoryName:classification.label,iconSelector:itemIconSelector(b,id),grade:category===0x60?meta&15:null,meta,extra:b[p+13],offset:p,instances:this.instances.filter(s=>s.itemId===id),raw:Array.from(span(b,p,14))};
 }
 readCastle(id){
  integer(id,0,124,'城池 ID');const b=this.#bytes,p=PROFILE.castles.base+id*20;
  return {id,name:decodeText(b,p,9),offset:p,state:readCastleState(b,id),location:{x:(u16(b,p+14)%41)*8+b[p+16],y:Math.floor(u16(b,p+14)/41)*8+b[p+17]},neighbors:Array.from(span(b,p+9,4)).filter(n=>n!==255),raw:Array.from(span(b,p,20))};
 }
 get instances(){return Array.from({length:80},(_,slot)=>{const p=PROFILE.instances.base+slot*4;return {slot,itemId:u16(this.#bytes,p),ownerRaw:u16(this.#bytes,p+2),offset:p};});}
 snapshot(){
  const people=Array.from({length:713},(_,i)=>this.readPerson(i));
  const items=Array.from({length:300},(_,i)=>this.readItem(i));
  const castles=Array.from({length:125},(_,i)=>this.readCastle(i));
  const groups=new Map();
  for(const p of people){if(!groups.has(p.factionId))groups.set(p.factionId,[]);groups.get(p.factionId).push(p);}
  const factions=[...groups.entries()].filter(([id])=>!this.factionExpansion||id<20||id===255).sort((a,b)=>a[0]-b[0]).map(([id,members])=>{
   const state=readFactionState(this.#bytes,id),leaders=state&&state.leaderId<241&&people[state.leaderId]?[people[state.leaderId]]:members.filter(p=>p.rank===8);
   return {id,state,ownedCastleIds:state?castles.filter(c=>c.id<123&&c.state?.factionId===id).map(c=>c.id):[],name:id===255?'未出仕／浪人':state&&!state.active?`未启用势力 #${id}`:leaders.length?leaders.map(p=>p.family+p.given).join('、')+' 家':`势力 #${id}`,members,leaders,castleIds:[...new Set(members.map(p=>p.castleId).filter(id=>id!==255))],offset:null};
  });
  if(this.factionExpansion){
   for(const row of factions)if(row.state&&row.id<20){
    row.state.relations.push(...Array.from({length:18},(_,i)=>relationView(20+i,this.factionExpansion.relation(row.id,20+i))));
    row.expansionCastles=this.factionExpansion.castles.filter(c=>c.ownerFactionId===row.id).map(c=>({
     ...c,governorName:c.governorId===0xffff?'未设置':people[c.governorId]?.name||'未确认',
     record:Array.from(span(this.#bytes,c.offset,18)),
    }));
    row.expansionCastleIds=row.expansionCastles.map(c=>c.id);
   }
   for(const ext of this.factionExpansion.factions){
    const leader=people[ext.leaderId],expansionCastles=this.factionExpansion.castles.filter(c=>c.ownerFactionId===ext.id).map(c=>({
     ...c,governorName:c.governorId===0xffff?'未设置':people[c.governorId]?.name||'未确认',
     record:Array.from(span(this.#bytes,c.offset,18)),
    }));
    // FEX1 stores one leader candidate per faction and optional governor candidates
    // per expansion castle. These are editor references, not runtime affiliations.
    const candidateIds=[ext.leaderId,...expansionCastles.map(c=>c.governorId)].filter(id=>id!==0xffff);
    const runtimeIntegrated=this.residentBindings.size>0;
    const members=runtimeIntegrated?people.filter(p=>this.residentBindings.get(p.id)?.factionId===ext.id):[...new Set(candidateIds)].map(id=>people[id]).filter(Boolean);
    const relations=Array.from({length:38},(_,target)=>relationView(target,this.factionExpansion.relation(ext.id,target)));
    const row={id:ext.id,name:ext.name,state:{
     active:true,isExtension:true,leaderId:ext.leaderId,homeCastleId:ext.homeCastleId,relations,
    },ownedCastleIds:[],expansionCastleIds:expansionCastles.map(c=>c.id),expansionCastles,
    members,plannedMembers:runtimeIntegrated?[]:ext.plannedMembers.map(member=>({...member,sourcePerson:people[member.personId]})),
    leaders:leader?[leader]:[],castleIds:[],offset:ext.offset,expansion:true,runtimeIntegrated,
    leaderIdentityName:ext.leaderIdentityName,leaderCandidate:ext.leaderCandidate,seatName:ext.seatName,seatCastleId:ext.seatCastleId,extensionRecord:ext};
    factions.push(row);
   }
  }
  const factionNames=new Map(factions.map(f=>[f.id,f.name]));
  const castleNames=new Map(castles.map(c=>[c.id,c.name]));for(const c of this.factionExpansion?.castles||[])castleNames.set(c.id,c.name);
  for(const p of people){p.factionName=factionNames.get(p.factionId);p.castleName=p.castleId===255?'未设置':castleNames.get(p.castleId)||'未确认';}
  for(const c of castles){c.factionName=c.state?(c.state.factionId===255?'无主':factionNames.get(c.state.factionId)||`势力 #${c.state.factionId}`):'未确认';c.governorName=c.state?(c.state.governorId<241?people[c.state.governorId]?.name||'未确认':'无城主'):'未确认';c.residents=people.filter(p=>p.castleId===c.id);c.neighborNames=c.neighbors.map(id=>castles[id].name);}
  return {people,items,castles,factions};
 }
 applyRecord(kind,id,draft,expectedRevision=this.revision){this.#requireWrite(kind);
  if(expectedRevision!==this.revision)fail('STALE_DRAFT','编辑期间资料已变化，请重新打开这条记录');
  const allowed=kind==='people'?['family','given','attrs','skills','affinity','portraitSelector']:kind==='items'?['name','value','iconSelector']:kind==='castles'?['name',...CASTLE_FIELDS.map(f=>f.key)]:kind==='factions'?['leaderId','homeCastleId']:null;
  if(!allowed)fail('READ_ONLY_RESOURCE','此资源当前只支持查阅');
  for(const field of Object.keys(draft))if(!allowed.includes(field))fail('UNSUPPORTED_FIELD',`字段 ${field} 未开放编辑`);
  const proposed=new Map();
  const add=(offset,data)=>{span(this.#bytes,offset,data.length);for(let i=0;i<data.length;i++)if(data[i]!==this.#bytes[offset+i])proposed.set(offset+i,data[i]);};
  const setText=(offset,capacity,value,leadingZero=false)=>{if(value===decodeText(this.#bytes,offset,capacity))return;add(offset,encodeField(value,capacity,span(this.#bytes,offset,capacity),{leadingZero}));};
  let label;
  if(kind==='people'){
   const person=this.readPerson(id),p=person.offset,n=person.nameOffset;label=person.name;
   if(draft.portraitSelector!==undefined){const value=validatePortraitSelector(draft.portraitSelector);portraitImage(this.#bytes,value);add(person.portraitOffset,[value>>>8,value&255]);}
   if(draft.family!==undefined)setText(n+2,6,draft.family);
   if(draft.given!==undefined)setText(n+8,8,draft.given,true);
   if(draft.attrs!==undefined){if(!Array.isArray(draft.attrs)||draft.attrs.length!==6)fail('INVALID_FIELD','需要完整的六项能力值');draft.attrs.forEach((v,i)=>add(p+0x27+i,[integer(v,0,255,STATS[i])]));}
   if(draft.skills!==undefined){
    if(!Array.isArray(draft.skills)||draft.skills.length!==7)fail('INVALID_FIELD','仅支持编辑七项已验证技能，文化保持原值');
    const packed=Array.from(span(this.#bytes,p+0x2d,2));
    draft.skills.forEach((value,i)=>{integer(value,0,3,SKILLS[i]);const slot=Math.floor(i/4),shift=6-2*(i%4);packed[slot]=(packed[slot]&~(3<<shift))|(value<<shift);});add(p+0x2d,packed);
   }
   if(draft.affinity!==undefined)add(p+0x3b,[(this.#bytes[p+0x3b]&0xf0)|integer(draft.affinity,0,15,'相性原码')]);
  }else if(kind==='items'){
   const item=this.readItem(id);label=item.name;if(draft.name!==undefined)setText(item.offset,10,draft.name);
   if(draft.value!==undefined)add(item.offset+11,[integer(draft.value,0,255,'基础价值')]);
  }else if(kind==='castles'){const castle=this.readCastle(id);label=castle.name;if(draft.name!==undefined)setText(castle.offset,9,draft.name);for(const f of CASTLE_FIELDS)if(draft[f.key]!==undefined){if(!castle.state)fail('INVALID_CASTLE','此资料没有已确认的城池运行记录');const write=castleFieldBytes(this.#bytes,castle.state,f.key,draft[f.key]);add(write.offset,write.data);}}
  else{const faction=this.snapshot().factions.find(row=>row.id===id&&row.expansion);if(!faction)fail('READ_ONLY_RESOURCE','原版势力仍保持只读');label=faction.name;for(const patch of writeFactionExpansion(this.#bytes,this.factionExpansion,id,draft))proposed.set(patch.offset,patch.after);}
  const patches=[...proposed].sort((a,b)=>a[0]-b[0]).map(([offset,after])=>({offset,before:this.#bytes[offset],after}));
  for(const patch of patches)if(!this.#recordOwns(kind,id,patch.offset))fail('CROSS_RECORD_WRITE','写入超出当前记录的允许范围',{kind,id,offset:patch.offset});
  let candidate=new Uint8Array(this.#bytes);for(const p of patches)candidate[p.offset]=p.after;
  if(kind==='items'&&draft.iconSelector!==undefined)candidate=setItemIcon(candidate,id,draft.iconSelector);
  if(candidate.length!==this.#bytes.length||kind==='items'&&draft.iconSelector!==undefined){patches.length=0;for(let offset=0;offset<Math.max(candidate.length,this.#bytes.length);offset++)if(candidate[offset]!==this.#bytes[offset])patches.push({offset,before:this.#bytes[offset],after:candidate[offset]});}
  if(!patches.length)return false;
  validateRom(candidate,{verifyChecksum:false});
  const beforeLength=this.#bytes.length;this.#bytes=candidate;this.directory=readRomDirectory(candidate);if(kind==='factions')this.factionExpansion=readFactionExpansion(candidate,this.directory);this.#undo.push({kind,id,label,patches,beforeLength,afterLength:candidate.length});this.#redo=[];this.revision++;return true;
 }
 #recordOwns(kind,id,offset){
  if(kind==='people'){
   const n=PROFILE.names.base+id*16,p=PROFILE.people.base+id*60;
   return(offset>=n+2&&offset<n+18)||(offset>=p+0x27&&offset<=p+0x2e)||offset===p+0x3b;
  }
  if(kind==='items'){const p=PROFILE.items.base+id*14;return(offset>=p&&offset<p+10)||offset===p+11;}
  if(kind==='castles'){const p=PROFILE.castles.base+id*20;const state=readCastleState(this.#bytes,id);return offset>=p&&offset<p+9||!!state&&offset>=state.offset+3&&offset<=state.offset+15;}
  if(kind==='factions'){const f=this.factionExpansion?.factions.find(row=>row.id===id);return !!f&&(offset>=this.factionExpansion.payloadOffset+0x798+(id-20)*2&&offset<this.factionExpansion.payloadOffset+0x79a+(id-20)*2||offset===f.offset+21);}
  return false;
 }
 undo(){this.#requireWrite();const t=this.#undo.pop();if(!t)return false;this.#bytes=new Uint8Array(this.#bytes);if(t.beforeLength!==undefined){const b=new Uint8Array(t.beforeLength);b.set(this.#bytes.subarray(0,b.length));this.#bytes=b;}for(const p of t.patches)if(p.offset<this.#bytes.length)this.#bytes[p.offset]=p.before;this.directory=readRomDirectory(this.#bytes);if(t.kind==='factions')this.factionExpansion=readFactionExpansion(this.#bytes,this.directory);this.#redo.push(t);this.revision++;return true;}
 redo(){this.#requireWrite();const t=this.#redo.pop();if(!t)return false;this.#bytes=new Uint8Array(this.#bytes);if(t.afterLength!==undefined){const b=new Uint8Array(t.afterLength);b.set(this.#bytes.subarray(0,b.length));this.#bytes=b;}for(const p of t.patches)if(p.offset<this.#bytes.length)this.#bytes[p.offset]=p.after;this.directory=readRomDirectory(this.#bytes);if(t.kind==='factions')this.factionExpansion=readFactionExpansion(this.#bytes,this.directory);this.#undo.push(t);this.revision++;return true;}
 exportBytes(){this.#requireWrite();
  validateRom(this.#bytes,{verifyChecksum:false});
  if(this.#undo.some(t=>t.kind.startsWith('map-')))requireWorldMap(this.#bytes);
  const ext=readMapExtension(this.#bytes);if(ext)verifyTownEngine(this.#bytes,ext);
  const permitted=new Set(this.#undo.flatMap(t=>t.patches.map(p=>p.offset)));
  for(let i=0;i<this.#bytes.length;i++)if(this.#bytes[i]!==this.#original[i]&&!permitted.has(i))fail('UNTRACKED_WRITE','存在不属于单条编辑事务的修改',{offset:i});
  const bytes=isWestRom(this.#bytes)&&worldNavigationDirty(this.#bytes)?rebuildWestNavigation(this.#bytes):new Uint8Array(this.#bytes);const sum=checksum(bytes);bytes[0x18e]=sum>>>8;bytes[0x18f]=sum&255;validateRom(bytes);return bytes;
 }
}
