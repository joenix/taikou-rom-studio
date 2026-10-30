import {PROFILE,STATS,SKILLS,RANKS,hex} from './profile.js';
import {validateRom} from './validate.js';
import {span,u16,decodeText,encodeField,integer,fail,checksum} from './codec.js';
export class RomDocument {
 #original;#bytes;#undo=[];#redo=[];
 constructor(bytes,filename,sha256){
  this.validation=validateRom(bytes);this.#original=new Uint8Array(bytes);this.#bytes=new Uint8Array(bytes);
  this.filename=filename;this.sha256=sha256;this.revision=0;
 }
 static async load(buffer,filename='game.bin'){
  const bytes=buffer instanceof Uint8Array?buffer:new Uint8Array(buffer);
  validateRom(bytes);
  const digest=await crypto.subtle.digest('SHA-256',bytes);
  return new RomDocument(bytes,filename,Array.from(new Uint8Array(digest),b=>b.toString(16).padStart(2,'0')).join(''));
 }
 get byteLength(){return this.#bytes.length;}
 get canUndo(){return this.#undo.length>0;}
 get canRedo(){return this.#redo.length>0;}
 get history(){return this.#undo.map(t=>({kind:t.kind,id:t.id,label:t.label,changes:t.patches.length}));}
 get changedBytes(){let n=0;for(let i=0;i<this.#bytes.length;i++)if(this.#bytes[i]!==this.#original[i])n++;return n;}
 get originalBytes(){return new Uint8Array(this.#original);}
 get workingBytes(){return new Uint8Array(this.#bytes);}
 readPerson(id){
  integer(id,0,712,'武将 ID');const b=this.#bytes,p=PROFILE.people.base+id*60,n=PROFILE.names.base+id*16;
  const family=decodeText(b,n+2,6),given=decodeText(b,n+8,8);
  return {id,family,given,name:family+' '+given,offset:p,nameOffset:n,
   attrs:Array.from(span(b,p+0x27,6)),skills:SKILLS.map((_,i)=>(b[p+0x2d+Math.floor(i/4)]>>>(6-2*(i%4)))&3),
   factionId:b[p+0x1a],castleId:b[p+0x1b],rank:b[p+0x1c],rankName:RANKS[b[p+0x1c]],
   strategyLevel:b[p+0x22],tacticsLevel:b[p+0x26],strategyXp:u16(b,p+0x20),tacticsXp:u16(b,p+0x24),affinity:b[p+0x3b]&15,
   selector:u16(b,n),raw:Array.from(span(b,p,60))};
 }
 readItem(id){
  integer(id,0,299,'宝物 ID');const b=this.#bytes,p=PROFILE.items.base+id*14,meta=b[p+12];
  const category=meta&0xe0;
  return {id,name:decodeText(b,p,10),value:b[p+11],category,categoryName:category===0x60?'武具':`类别 ${hex(category,2)}`,grade:category===0x60?meta&15:null,meta,extra:b[p+13],offset:p,instances:this.instances.filter(s=>s.itemId===id),raw:Array.from(span(b,p,14))};
 }
 readCastle(id){
  integer(id,0,124,'城池 ID');const b=this.#bytes,p=PROFILE.castles.base+id*20;
  return {id,name:decodeText(b,p,9),offset:p,neighbors:Array.from(span(b,p+9,4)).filter(n=>n!==255),raw:Array.from(span(b,p,20))};
 }
 get instances(){return Array.from({length:80},(_,slot)=>{const p=PROFILE.instances.base+slot*4;return {slot,itemId:u16(this.#bytes,p),ownerRaw:u16(this.#bytes,p+2),offset:p};});}
 snapshot(){
  const people=Array.from({length:713},(_,i)=>this.readPerson(i));
  const items=Array.from({length:300},(_,i)=>this.readItem(i));
  const castles=Array.from({length:125},(_,i)=>this.readCastle(i));
  const groups=new Map();
  for(const p of people){if(!groups.has(p.factionId))groups.set(p.factionId,[]);groups.get(p.factionId).push(p);}
  const factions=[...groups.entries()].sort((a,b)=>a[0]-b[0]).map(([id,members])=>{
   const leaders=members.filter(p=>p.rank===8);
   return {id,name:id===255?'未出仕／浪人':leaders.length?leaders.map(p=>p.family+p.given).join('、')+' 家':`势力 #${id}`,members,leaders,castleIds:[...new Set(members.map(p=>p.castleId).filter(id=>id!==255))],offset:null};
  });
  const factionNames=new Map(factions.map(f=>[f.id,f.name]));
  for(const p of people){p.factionName=factionNames.get(p.factionId);p.castleName=p.castleId===255?'未设置':castles[p.castleId].name;}
  for(const c of castles){c.residents=people.filter(p=>p.castleId===c.id);c.neighborNames=c.neighbors.map(id=>castles[id].name);}
  return {people,items,castles,factions};
 }
 applyRecord(kind,id,draft,expectedRevision=this.revision){
  if(expectedRevision!==this.revision)fail('STALE_DRAFT','编辑期间资料已变化，请重新打开这条记录');
  const allowed=kind==='people'?['family','given','attrs','skills','affinity']:kind==='items'?['name','value']:kind==='castles'?['name']:null;
  if(!allowed)fail('READ_ONLY_RESOURCE','此资源当前只支持查阅');
  for(const field of Object.keys(draft))if(!allowed.includes(field))fail('UNSUPPORTED_FIELD',`字段 ${field} 未开放编辑`);
  const proposed=new Map();
  const add=(offset,data)=>{span(this.#bytes,offset,data.length);for(let i=0;i<data.length;i++)if(data[i]!==this.#bytes[offset+i])proposed.set(offset+i,data[i]);};
  const setText=(offset,capacity,value,leadingZero=false)=>{if(value===decodeText(this.#bytes,offset,capacity))return;add(offset,encodeField(value,capacity,span(this.#bytes,offset,capacity),{leadingZero}));};
  let label;
  if(kind==='people'){
   const person=this.readPerson(id),p=person.offset,n=person.nameOffset;label=person.name;
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
  }else{const castle=this.readCastle(id);label=castle.name;if(draft.name!==undefined)setText(castle.offset,9,draft.name);}
  const patches=[...proposed].sort((a,b)=>a[0]-b[0]).map(([offset,after])=>({offset,before:this.#bytes[offset],after}));
  for(const patch of patches)if(!this.#recordOwns(kind,id,patch.offset))fail('CROSS_RECORD_WRITE','写入超出当前记录的允许范围',{kind,id,offset:patch.offset});
  if(!patches.length)return false;
  const candidate=new Uint8Array(this.#bytes);for(const p of patches)candidate[p.offset]=p.after;
  validateRom(candidate,{verifyChecksum:false});
  this.#bytes=candidate;this.#undo.push({kind,id,label,patches});this.#redo=[];this.revision++;return true;
 }
 #recordOwns(kind,id,offset){
  if(kind==='people'){
   const n=PROFILE.names.base+id*16,p=PROFILE.people.base+id*60;
   return(offset>=n+2&&offset<n+16)||(offset>=p+0x27&&offset<=p+0x2e)||offset===p+0x3b;
  }
  if(kind==='items'){const p=PROFILE.items.base+id*14;return(offset>=p&&offset<p+10)||offset===p+11;}
  if(kind==='castles'){const p=PROFILE.castles.base+id*20;return offset>=p&&offset<p+9;}
  return false;
 }
 undo(){const t=this.#undo.pop();if(!t)return false;for(const p of t.patches)this.#bytes[p.offset]=p.before;this.#redo.push(t);this.revision++;return true;}
 redo(){const t=this.#redo.pop();if(!t)return false;for(const p of t.patches)this.#bytes[p.offset]=p.after;this.#undo.push(t);this.revision++;return true;}
 exportBytes(){
  validateRom(this.#bytes,{verifyChecksum:false});
  const permitted=new Set(this.#undo.flatMap(t=>t.patches.map(p=>p.offset)));
  for(let i=0;i<this.#bytes.length;i++)if(this.#bytes[i]!==this.#original[i]&&!permitted.has(i))fail('UNTRACKED_WRITE','存在不属于单条编辑事务的修改',{offset:i});
  const bytes=new Uint8Array(this.#bytes);const sum=checksum(bytes);bytes[0x18e]=sum>>>8;bytes[0x18f]=sum&255;validateRom(bytes);return bytes;
 }
}
