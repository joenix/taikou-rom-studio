import {decompressTaikoAsset,unpackTaikoTiles} from './portraits.js';
import {span,u16,integer,fail} from './codec.js';
import {readMapExtension,writeMapExtension} from './map-extension.js';
import {readRomDirectory,relocateRomDirectoryAfterInsert} from './rom-directory.js';
const HOOK=0x54e4c,ORIGINAL=[0x20,0x7c,0,8,0x8f,0x3f,0x10,0x30,8,0];
const MAGIC=new TextEncoder().encode('TKICON01');
const long=(b,p)=>u16(b,p)*65536+u16(b,p+2);
const put=(b,p,n)=>b.set([n>>>24,n>>>16&255,n>>>8&255,n&255],p);
export function itemIconTable(bytes){
 const hook=span(bytes,HOOK,10);
 if(ORIGINAL.every((v,i)=>hook[i]===v))return null;
 if(hook[0]!==0x20||hook[1]!==0x7c||hook[6]!==0x10||hook[7]!==0x30||hook[8]!==0x18||hook[9]!==0)fail('INVALID_ITEM_ICONS','宝物图标读取指令不匹配');
 const table=long(bytes,HOOK+2),header=table-16;
 if(header<1409988||table+300>bytes.length)fail('INVALID_ITEM_ICONS','宝物图标目录越界');
 if(!MAGIC.every((v,i)=>bytes[header+i]===v)||long(bytes,header+8)!==300||long(bytes,header+12)!==1)fail('INVALID_ITEM_ICONS','宝物图标目录版本异常');
 for(const n of span(bytes,table,300))integer(n,0,19,'宝物图标');
 return table;
}
export function itemIconSelector(bytes,id){integer(id,0,299,'宝物 ID');const table=itemIconTable(bytes);return bytes[table===null?0x88f32+id*14+13:table+id];}
export function itemIconImage(bytes,selector){
 integer(selector,0,19,'宝物图标');const at=long(bytes,0xe2bfe+selector*4),end=long(bytes,0xe2bfe+(selector+1)*4);
 if(at<0xe0a68||end<=at||end>0xe2bfe)fail('INVALID_ITEM_ICONS','宝物图像指针异常');
 const image=unpackTaikoTiles(decompressTaikoAsset(span(bytes,at,end-at),512).bytes,4);
 if(image.width!==32||image.height!==32)fail('INVALID_ITEM_ICONS','宝物图像尺寸异常');
 const colors=Array.from({length:16},(_,i)=>{const n=u16(bytes,0x8a2c0+i*2);return [((n>>>1)&7)*255/7,((n>>>5)&7)*255/7,((n>>>9)&7)*255/7];});
 return {...image,colors};
}
export function setItemIcon(bytes,id,selector){
 integer(id,0,299,'宝物 ID');integer(selector,0,19,'宝物图标');itemIconImage(bytes,selector);
 let table=itemIconTable(bytes);if(itemIconSelector(bytes,id)===selector)return bytes;
 let out;
 if(table===null){
  const map=readMapExtension(bytes),directory=readRomDirectory(bytes),offset=map?map.manifestOffset:bytes.length;
  if(bytes.length+316>0x200000)fail('INVALID_ITEM_ICONS','超出当前已核对的 ROM 地址范围');
  out=new Uint8Array(bytes.length+316);out.set(bytes.subarray(0,offset));
  out.set(MAGIC,offset);put(out,offset+8,300);put(out,offset+12,1);table=offset+16;
  for(let i=0;i<300;i++)out[table+i]=bytes[0x88f32+i*14+13];
  if(map)writeMapExtension(out,map,offset+316);
  relocateRomDirectoryAfterInsert(out,directory,offset,316);
  out.set([0x20,0x7c],HOOK);put(out,HOOK+2,table);out.set([0x10,0x30,0x18,0],HOOK+6);
  put(out,0x1a4,out.length-1);
 }else out=new Uint8Array(bytes);
 out[table+id]=selector;itemIconTable(out);return out;
}
