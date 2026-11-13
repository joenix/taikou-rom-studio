import {fail,span} from './codec.js';
import {PROFILE} from './profile.js';

const MAGIC=new TextEncoder().encode('TKROMD01'),TRAILER=32,MAX_MANIFEST=0x10000;
const ascii=new TextDecoder('ascii'),utf8=new TextDecoder('utf-8',{fatal:true});
const cache=new WeakMap();
const u16=(b,p)=>(b[p]<<8)|b[p+1];
const u32=(b,p)=>(u16(b,p)*0x10000+u16(b,p+2))>>>0;
function crc32(bytes){let c=0xffffffff;for(const value of bytes){c^=value;for(let i=0;i<8;i++)c=(c>>>1)^((c&1)?0xedb88320:0);}return(c^0xffffffff)>>>0;}
function matches(bytes,p){return p>=0&&p+MAGIC.length<=bytes.length&&MAGIC.every((v,i)=>bytes[p+i]===v);}
function parseCandidate(bytes,p){
 if(!matches(bytes,p)||p+TRAILER>bytes.length)return null;
 if(u16(bytes,p+8)!==1||u16(bytes,p+10)!==TRAILER)return null;
 const offset=u32(bytes,p+12),length=u32(bytes,p+16),crc=u32(bytes,p+20);
 if(!length||length>MAX_MANIFEST||offset<0x200||offset+length!==p)return null;
 const payload=span(bytes,offset,length);if(crc32(payload)!==crc)return null;
 let manifest;try{manifest=JSON.parse(utf8.decode(payload));}catch{return null;}
 if(manifest?.format!=='taikou-rom-directory'||manifest.directory_schema!==1||manifest.game_id!=='md-taikou-pro'||
    typeof manifest.profile_id!=='string'||!manifest.resources||typeof manifest.resources!=='object'||!Array.isArray(manifest.features))return null;
 return {manifest,markerOffset:p,payloadOffset:offset,payloadLength:length,crc};
}
export function readRomDirectory(bytes){
 if(cache.has(bytes))return cache.get(bytes);
 let foundMagic=false,valid=null;
 for(let p=bytes.length-TRAILER;p>=0;p--){if(!matches(bytes,p))continue;foundMagic=true;const candidate=parseCandidate(bytes,p);if(candidate){valid=candidate;break;}}
 if(!valid&&foundMagic)fail('INVALID_ROM_DIRECTORY','ROM 内的资料工坊目录损坏或格式不受支持');
 if(!valid){cache.set(bytes,null);return null;}
 const {manifest}=valid;
 if(manifest.profile_id!=='md-taikou-initial-tables-v1')fail('UNSUPPORTED_ROM_PROFILE',`不支持 ROM 数据布局 ${manifest.profile_id}`);
 const expected={
  people:[PROFILE.people.base,PROFILE.people.stride,PROFILE.people.count,'person.initial.v1'],
  names:[PROFILE.names.base,PROFILE.names.stride,PROFILE.names.count,'person.name.v1'],
  portraits:[PROFILE.portraits.base,PROFILE.portraits.stride,PROFILE.portraits.count,'person.portrait-selector.v1'],
  items:[PROFILE.items.base,PROFILE.items.stride,PROFILE.items.count,'item.initial.v1'],
  item_instances:[PROFILE.instances.base,PROFILE.instances.stride,PROFILE.instances.count,'item.instance.v1'],
  castles:[PROFILE.castles.base,PROFILE.castles.stride,PROFILE.castles.count,'castle.initial.v1'],
 };
 for(const [id,[offset,stride,count,schema]] of Object.entries(expected)){
  const r=manifest.resources[id];if(!r||r.offset!==offset||r.stride!==stride||r.count!==count||r.schema!==schema)
   fail('INVALID_ROM_DIRECTORY',`ROM 目录中的 ${id} 布局与已支持的数据格式不一致`);
  if(!Number.isSafeInteger(r.offset+r.stride*r.count)||r.offset+r.stride*r.count>bytes.length)
   fail('INVALID_ROM_DIRECTORY',`ROM 目录中的 ${id} 范围越界`);
 }
 const fex=manifest.resources.faction_expansion;
 if(fex&&(!Number.isInteger(fex.offset)||fex.length!==0x804||fex.schema!=='fex1.payload.v1'||fex.offset+fex.length>bytes.length))
  fail('INVALID_ROM_DIRECTORY','FEX1 资源声明越界或格式不匹配');
 const glyphs=manifest.resources.place_glyphs;
 const visit=manifest.resources.castle_visit_gate;
 const visitHooks=manifest.resources.native_visit_hooks;
 if(visitHooks){
  if(visitHooks.schema!=='absolute-jump-hooks.v1'||!Number.isSafeInteger(visitHooks.code_offset)||!Number.isSafeInteger(visitHooks.code_bytes)||
     visitHooks.code_offset<0x200||visitHooks.code_bytes<1||visitHooks.code_offset+visitHooks.code_bytes>bytes.length||!Array.isArray(visitHooks.entries)||visitHooks.entries.length>32)
   fail('INVALID_ROM_DIRECTORY','城池访问跳转表格式或范围异常');
  const occupied=new Set();
  for(const entry of visitHooks.entries){
   if(!Array.isArray(entry)||entry.length!==3||!entry.every(Number.isSafeInteger))fail('INVALID_ROM_DIRECTORY','城池访问跳转记录异常');
   const [at,target,length]=entry;
   if(at<0x200||length<6||length>16||length%2||at+length>bytes.length||target<visitHooks.code_offset||target>=visitHooks.code_offset+visitHooks.code_bytes)
    fail('INVALID_ROM_DIRECTORY','城池访问跳转记录越界');
   const expected=[0x4e,0xf9,target>>>24,target>>>16&255,target>>>8&255,target&255];
   while(expected.length<length)expected.push(0x4e,0x71);
   for(let i=0;i<length;i++){if(occupied.has(at+i)||bytes[at+i]!==expected[i])fail('INVALID_ROM_DIRECTORY','城池访问跳转指令不匹配');occupied.add(at+i);}
  }
 }
 if(visit&&(visit.schema!=='castle-native-visit.v1'||![visit.hook_offset,visit.handler_offset,visit.code_offset,visit.code_bytes].every(Number.isSafeInteger)||
    visit.code_offset<0x200||visit.code_bytes<1||visit.code_offset+visit.code_bytes>bytes.length||
    visit.handler_offset<visit.code_offset||visit.handler_offset>=visit.code_offset+visit.code_bytes||
    visit.hook_offset<0x200||visit.hook_offset+6>bytes.length||
    bytes[visit.hook_offset]!==0x4e||bytes[visit.hook_offset+1]!==0xf9||u32(bytes,visit.hook_offset+2)!==visit.handler_offset))
  fail('INVALID_ROM_DIRECTORY','城池访问入口声明越界或与 ROM 指令不匹配');
 if(glyphs&&(!Number.isInteger(glyphs.hook_offset)||!Number.isInteger(glyphs.table_offset)||
    !Number.isInteger(glyphs.resolver_offset)||glyphs.schema!=='place-glyph-overlay.v1'||
    !Number.isInteger(glyphs.count)||glyphs.count<1||glyphs.count>64||
    glyphs.table_offset+glyphs.count*38>bytes.length||glyphs.resolver_offset>=bytes.length))
  fail('INVALID_ROM_DIRECTORY','地名字形资源声明越界或格式不匹配');
 const result={...valid,release:manifest.build?.release||'marked-build',factionExpansion:Boolean(fex)};
 cache.set(bytes,result);return result;
}

/** Update the manifest's absolute payload pointer after bytes are inserted before it. */
export function relocateRomDirectoryAfterInsert(bytes,directory,insertAt,amount){
 if(!directory||insertAt>directory.payloadOffset||amount<=0)return;
 const p=directory.markerOffset+amount;
 const shift=(value,key)=>Number.isSafeInteger(value)&&value>=insertAt&&['offset','directory_offset','table_offset','start'].includes(key)?value+amount:value;
 const visit=(value)=>{
  if(Array.isArray(value))return value.map(visit);
  if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).map(([key,v])=>[key,typeof v==='object'&&v!==null?visit(v):shift(v,key)]));
  return value;
 };
 const manifest=visit(directory.manifest),encoded=new TextEncoder().encode(JSON.stringify(manifest));
 if(encoded.length>directory.payloadLength)fail('INVALID_ROM_DIRECTORY','更新后的 ROM 目录超过预留长度');
 const payload=new Uint8Array(directory.payloadLength);payload.fill(0x20);payload.set(encoded);
 const payloadAt=directory.payloadOffset+amount,footerAt=p;
 bytes.set(payload,payloadAt);
 const put=(at,value)=>bytes.set([(value>>>24)&255,(value>>>16)&255,(value>>>8)&255,value&255],at);
 put(footerAt+12,payloadAt);put(footerAt+20,crc32(payload));cache.delete(bytes);
}
