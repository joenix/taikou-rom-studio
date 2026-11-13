import {span,u16,fail} from './codec.js';
import {readRomDirectory} from './rom-directory.js';
const MAGIC='TKMAP001';
const ascii=new TextDecoder(),encoder=new TextEncoder();
export const EXTENSION_MANIFEST_SIZE=2048;
export function readMapExtension(bytes){
 if(bytes.length<16)return null;
 readRomDirectory(bytes);
 const limit=bytes.length;
 let found=false;
 for(let footer=limit-16;footer>=0;footer--){
  if(ascii.decode(bytes.subarray(footer,footer+8))!==MAGIC)continue;found=true;
  const offset=u16(bytes,footer+8)*65536+u16(bytes,footer+10),size=u16(bytes,footer+12)*65536+u16(bytes,footer+14);
  if(size!==EXTENSION_MANIFEST_SIZE||offset+size!==footer)continue;
  let meta;try{meta=JSON.parse(ascii.decode(span(bytes,offset,size)).replace(/\0+$/,''));}catch{continue;}
  if(meta.version!==1||meta.newTownId!==17||meta.newTownBase!==0x46f||typeof meta.active!=='boolean'||!Number.isInteger(meta.originalLength)||meta.originalLength<0x89f9a||meta.originalLength>=offset)continue;
  let valid=true;for(const [key,length] of Object.entries({entries:21*8,entryFlags:21,bases:36,names:72,nameText:26,interiors:216*64,trade:18,prices:18,merchantSeeds:18,exitGuard:128})){
   if(!Number.isInteger(meta[key])||meta[key]<meta.originalLength||meta[key]+length>offset){valid=false;break;}
   span(bytes,meta[key],length);
  }
  if(valid)return {...meta,manifestOffset:offset};
 }
 if(found)fail('INVALID_MAP_EXTENSION','地图扩展目录损坏或无法读取');
 return null;
}
export function writeMapExtension(bytes,meta,offset){
 const {manifestOffset,...data}=meta;void manifestOffset;
 const encoded=encoder.encode(JSON.stringify(data));if(encoded.length>EXTENSION_MANIFEST_SIZE)fail('INVALID_MAP_EXTENSION','地图扩展目录超过容量');
 bytes.fill(0,offset,offset+EXTENSION_MANIFEST_SIZE);bytes.set(encoded,offset);const footer=offset+EXTENSION_MANIFEST_SIZE;bytes.set(encoder.encode(MAGIC),footer);
 const put=(p,n)=>bytes.set([n>>>24,(n>>>16)&255,(n>>>8)&255,n&255],p);put(footer+8,offset);put(footer+12,EXTENSION_MANIFEST_SIZE);
}
