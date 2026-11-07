import {u16,fail} from './codec.js';
import {readMapExtension} from './map-extension.js';
import {itemIconTable} from './item-icons.js';
const text=new TextDecoder();
const long=(b,p)=>u16(b,p)*65536+u16(b,p+2);
/** Read embedded design dates, not historical certainty or active runtime scheduling. */
export function readAppearance(bytes){
 const map=readMapExtension(bytes),icon=itemIconTable(bytes);
 const ends=[bytes.length,map?.originalLength,icon===null?null:icon-16].filter(Number.isInteger);
 for(const end of new Set(ends)){
  const footer=end-48;
  if(footer<0||text.decode(bytes.subarray(footer,footer+8))!=='TKAMEND1')continue;
  const start=long(bytes,footer+8),length=long(bytes,footer+12);
  if(start<0x89f9a||start+length>footer||length<32||text.decode(bytes.subarray(start,start+8))!=='TKAM6001')fail('INVALID_APPEARANCE','人物生年配置范围异常');
  const count=u16(bytes,start+10),stride=long(bytes,start+16),mask=long(bytes,start+20);
  if(u16(bytes,start+8)!==1||count!==713||stride!==8||mask!==90||long(bytes,start+24)!==count*stride||length!==32+mask+count*stride)fail('INVALID_APPEARANCE','不支持的人物生年配置格式');
  const records=Array.from({length:count},(_,id)=>{
   const p=start+32+mask+id*stride,birthYear=u16(bytes,p),birthMonth=bytes[p+2],appearanceYear=u16(bytes,p+4),appearanceMonth=bytes[p+6];
   if(!birthYear||birthMonth<1||birthMonth>12||!appearanceYear||appearanceMonth<1||appearanceMonth>12)fail('INVALID_APPEARANCE','人物配置年月异常',{record:id});
   return {birthYear,birthMonth,appearanceYear,appearanceMonth,referenceMissing:Boolean(bytes[p+3]&2)};
  });
  return {start,length,digest:bytes.slice(footer+16,footer+48),records};
 }
 return null;
}
export async function verifyAppearance(bytes){
 const meta=readAppearance(bytes);if(!meta)return;
 const digest=new Uint8Array(await crypto.subtle.digest('SHA-256',bytes.subarray(meta.start,meta.start+meta.length)));
 if(digest.some((v,i)=>v!==meta.digest[i]))fail('INVALID_APPEARANCE','人物生年配置校验失败');
}
