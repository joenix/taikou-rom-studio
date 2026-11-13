import {isWestRom,readWestLayout} from './west-layout.js';
import CURRENT_RELEASE from './release-v14017.json' with {type:'json'};
import {itemIconTable} from './item-icons.js';
import {readFactionExpansion} from './faction-expansion.js';
import {readRomDirectory} from './rom-directory.js';
import {readRoadFlow} from './road-flow.js';
import {PROFILE,RELEASE} from './profile.js';
import {span,u16,decodeText,fail,checksum} from './codec.js';
export function validateRom(bytes,{verifyChecksum=true}={}){
 if(!(bytes instanceof Uint8Array)||bytes.length<0x89f9a||bytes.length>16*1024*1024||bytes.length%2)fail('INVALID_SIZE','文件大小不符合支持的 MD 太阁 ROM 布局');
 const ascii=new TextDecoder('ascii');
 if(!ascii.decode(span(bytes,0x100,16)).startsWith('SEGA'))fail('NOT_MD_ROM','不是有效的 Mega Drive ROM；不支持压缩包或带交错头的 SMD 文件',{offset:0x100});
 const title=ascii.decode(span(bytes,0x120,48)).trim(),directory=readRomDirectory(bytes),
  factionExpansion=readFactionExpansion(bytes,directory),release=directory?{title,version:directory.release,directory}:
  isWestRom(bytes)?{title,west:true}:
  factionExpansion?{title,version:'1.42',factionExpansion:true}:[CURRENT_RELEASE,RELEASE].find(r=>r.title===title);
 if(!release||ascii.decode(span(bytes,0x150,48)).trim()!==title)fail('NOT_TAIKOU','请选择受支持的太阁 PRO ROM（含 v1.42 势力数据版）',{offset:0x120});
 readRoadFlow(bytes,directory);
 if(release.west)readWestLayout(bytes,{fresh:true});
 for(const s of [...RELEASE.signatures,...(release===CURRENT_RELEASE?CURRENT_RELEASE.signatures:[])]){const actual=Array.from(span(bytes,s.offset,s.hex.length/2),b=>b.toString(16).padStart(2,'0')).join('');if(actual!==s.hex)fail('UNSUPPORTED_LAYOUT','版本关键代码不匹配',{offset:s.offset});}
 for(const s of PROFILE.signatures){
  const value=Array.from(span(bytes,s.offset,s.hex.length/2),b=>b.toString(16).padStart(2,'0')).join('');
  if(value!==s.hex)fail('UNSUPPORTED_LAYOUT',`关键读取指令不匹配：${s.meaning}`,{offset:s.offset,expected:s.hex,actual:value});
 }
 for(let id=0;id<PROFILE.people.count;id++){
  const p=PROFILE.people.base+id*60,n=PROFILE.names.base+id*16;
  span(bytes,p,60);span(bytes,n,16);span(bytes,PROFILE.portraits.base+id*16,2);
  if(u16(bytes,p)!==id)fail('RECORD_ID_MISMATCH','武将记录编号不连续',{resource:'people',record:id,offset:p});
  if(!decodeText(bytes,n+2,6)||!decodeText(bytes,n+8,8))fail('EMPTY_NAME','武将姓名不能为空',{resource:'people',record:id,offset:n});
  if(bytes[p+0x1c]>8)fail('INVALID_RANK','武将身份编号超出已支持范围',{record:id,offset:p+0x1c});
  if(bytes[p+0x1b]!==255&&bytes[p+0x1b]>=125)fail('INVALID_CASTLE','武将引用不存在的初始居城',{record:id,offset:p+0x1b});
  for(const f of [0x22,0x26])if(bytes[p+f]<1||bytes[p+f]>100)fail('INVALID_LEVEL','武将初始等级超出已验证范围',{record:id,offset:p+f});
 }
 for(let id=0;id<300;id++){
  const p=PROFILE.items.base+id*14;span(bytes,p,14);
  if(!decodeText(bytes,p,10))fail('EMPTY_NAME','宝物名称不能为空',{resource:'items',record:id,offset:p});
  if(bytes[p+10]!==0)fail('ITEM_RESERVED_BYTE','宝物名称后的保留字节异常；可能曾被旧编辑器的 16 位价格写入破坏',{resource:'items',record:id,offset:p+10});
 }
 for(let slot=0;slot<80;slot++){
  const p=PROFILE.instances.base+slot*4;span(bytes,p,4);
  if(u16(bytes,p)>=300)fail('INVALID_ITEM_REFERENCE','初始实例引用了不存在的宝物',{resource:'instances',record:slot,offset:p});
 }
 for(let id=0;id<125;id++){
  const p=PROFILE.castles.base+id*20;span(bytes,p,20);
  if(!decodeText(bytes,p,9))fail('EMPTY_NAME','城池名称不能为空',{resource:'castles',record:id,offset:p});
  for(let j=9;j<13;j++)if(bytes[p+j]!==255&&bytes[p+j]>=125)fail('INVALID_NEIGHBOR','城池邻接候选引用超出范围',{record:id,offset:p+j});
 }
 itemIconTable(bytes);
 const storedChecksum=u16(bytes,0x18e),computedChecksum=checksum(bytes);
 if(verifyChecksum&&storedChecksum!==computedChecksum)fail('CHECKSUM_MISMATCH','MD 校验和不匹配，ROM 可能被损坏或未经正确导出',{offset:0x18e,expected:storedChecksum,actual:computedChecksum});
 return {profile:PROFILE.id,version:release.version||null,factionExpansion:Boolean(factionExpansion),directory,checks:7,storedChecksum,computedChecksum,checksumMatches:storedChecksum===computedChecksum};
}
