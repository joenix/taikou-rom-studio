import {PROFILE} from './profile.js';
import {span,u16,decodeText,fail,checksum} from './codec.js';
export function validateRom(bytes,{verifyChecksum=true}={}){
 if(!(bytes instanceof Uint8Array)||bytes.length<0x89f9a||bytes.length>16*1024*1024||bytes.length%2)fail('INVALID_SIZE','文件大小不符合支持的 MD 太阁 ROM 布局');
 const ascii=new TextDecoder('ascii');
 if(!ascii.decode(span(bytes,0x100,16)).startsWith('SEGA'))fail('NOT_MD_ROM','不是有效的 Mega Drive ROM；不支持压缩包或带交错头的 SMD 文件',{offset:0x100});
 // These files contain a legacy typo in the domestic title bytes; match verified bytes, not a corrected display name.
 if(Array.from(span(bytes,0x120,10),b=>b.toString(16).padStart(2,'0')).join('')!=='91be8d7d97a78e559360')fail('NOT_TAIKOU','ROM 游戏标识不是支持的《太阁立志传》',{offset:0x120});
 for(const s of PROFILE.signatures){
  const value=Array.from(span(bytes,s.offset,s.hex.length/2),b=>b.toString(16).padStart(2,'0')).join('');
  if(value!==s.hex)fail('UNSUPPORTED_LAYOUT',`关键读取指令不匹配：${s.meaning}`,{offset:s.offset,expected:s.hex,actual:value});
 }
 for(let id=0;id<PROFILE.people.count;id++){
  const p=PROFILE.people.base+id*60,n=PROFILE.names.base+id*16;
  span(bytes,p,60);span(bytes,n,16);
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
 const storedChecksum=u16(bytes,0x18e),computedChecksum=checksum(bytes);
 if(verifyChecksum&&storedChecksum!==computedChecksum)fail('CHECKSUM_MISMATCH','MD 校验和不匹配，ROM 可能被损坏或未经正确导出',{offset:0x18e,expected:storedChecksum,actual:computedChecksum});
 return {profile:PROFILE.id,checks:7,storedChecksum,computedChecksum,checksumMatches:storedChecksum===computedChecksum};
}
