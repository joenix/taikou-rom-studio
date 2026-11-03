import {span,u16,fail} from './codec.js';
const MAGIC='TKMAP001';
const ascii=new TextDecoder(),encoder=new TextEncoder();
export const EXTENSION_MANIFEST_SIZE=2048;
export function readMapExtension(bytes){
 if(bytes.length<16||ascii.decode(bytes.subarray(bytes.length-16,bytes.length-8))!==MAGIC)return null;
 const footer=bytes.length-16,offset=u16(bytes,footer+8)*65536+u16(bytes,footer+10),size=u16(bytes,footer+12)*65536+u16(bytes,footer+14);
 if(size!==EXTENSION_MANIFEST_SIZE||offset+size!==footer)fail('INVALID_MAP_EXTENSION','地图扩展目录范围异常');
 let meta;try{meta=JSON.parse(ascii.decode(span(bytes,offset,size)).replace(/\0+$/,''));}catch{fail('INVALID_MAP_EXTENSION','地图扩展目录无法读取');}
 if(meta.version!==1||meta.newTownId!==17||meta.newTownBase!==0x46f||typeof meta.active!=='boolean'||!Number.isInteger(meta.originalLength)||meta.originalLength<0x89f9a||meta.originalLength>=offset)fail('INVALID_MAP_EXTENSION','不支持的地图扩展版本');
 for(const [key,length] of Object.entries({entries:21*8,entryFlags:21,bases:36,names:72,nameText:26,interiors:216*64,trade:18,prices:18,merchantSeeds:18,exitGuard:128})){
  if(!Number.isInteger(meta[key])||meta[key]<meta.originalLength||meta[key]+length>offset)fail('INVALID_MAP_EXTENSION',`地图扩展 ${key} 越界`);span(bytes,meta[key],length);
 }
 return {...meta,manifestOffset:offset};
}
export function writeMapExtension(bytes,meta,offset){
 const {manifestOffset,...data}=meta;void manifestOffset;
 const encoded=encoder.encode(JSON.stringify(data));if(encoded.length>EXTENSION_MANIFEST_SIZE)fail('INVALID_MAP_EXTENSION','地图扩展目录超过容量');
 bytes.fill(0,offset,offset+EXTENSION_MANIFEST_SIZE);bytes.set(encoded,offset);const footer=offset+EXTENSION_MANIFEST_SIZE;bytes.set(encoder.encode(MAGIC),footer);
 const put=(p,n)=>bytes.set([n>>>24,(n>>>16)&255,(n>>>8)&255,n&255],p);put(footer+8,offset);put(footer+12,EXTENSION_MANIFEST_SIZE);
}
