export class RomError extends Error {
 constructor(code,message,details={}){super(message);this.name='RomError';this.code=code;this.details=details;}
}
export function fail(code,message,details){throw new RomError(code,message,details);}
export function span(bytes,offset,length){
 if(!Number.isSafeInteger(offset)||!Number.isSafeInteger(length)||offset<0||length<0||offset+length>bytes.length)fail('OUT_OF_BOUNDS','数据范围超出 ROM',{offset,length});
 return bytes.subarray(offset,offset+length);
}
export function u16(bytes,offset){const b=span(bytes,offset,2);return b[0]*256+b[1];}
const decoder=new TextDecoder('shift_jis',{fatal:true});
export function decodeText(bytes,offset,length){
 try{return decoder.decode(span(bytes,offset,length)).replace(/\0/g,'').trim();}
 catch(error){if(error instanceof RomError)throw error;fail('INVALID_TEXT','名称包含无法解码的 Shift-JIS 字节',{offset,length});}
}
let encodingMap;
function getEncodingMap(){
 if(encodingMap)return encodingMap;
 const map=new Map();
 function add(bytes){try{const text=decoder.decode(Uint8Array.from(bytes));if([...text].length===1&&text!=='\0'&&!map.has(text))map.set(text,bytes);}catch{/* Invalid Shift-JIS pair. */}}
 for(let i=0x20;i<=0x7e;i++)add([i]);for(let i=0xa1;i<=0xdf;i++)add([i]);
 for(let h=0x81;h<=0xfc;h++)if(h<=0x9f||h>=0xe0)for(let l=0x40;l<=0xfc;l++)if(l!==0x7f)add([h,l]);
 encodingMap=map;return map;
}
export function encodeField(text,capacity,old,{leadingZero=false}={}){
 if(typeof text!=='string'||!text.trim()||/[\u0000-\u001f\u007f]/.test(text))fail('INVALID_NAME','名称不能为空，也不能包含控制字符');
 const encoded=[];const map=getEncodingMap();
 for(const char of text.trim()){const bytes=map.get(char);if(!bytes)fail('UNENCODABLE_TEXT',`字符「${char}」无法写入原 ROM 的 Shift-JIS 字库`);encoded.push(...bytes);}
 const prefix=leadingZero?Math.max(0,old.findIndex(b=>b!==0)):0;
 if(encoded.length+prefix>capacity)fail('TEXT_TOO_LONG',`名称最多 ${capacity-prefix} 个编码字节，当前为 ${encoded.length} 个`);
 const out=new Uint8Array(capacity);out.set(encoded,prefix);return out;
}
export function integer(value,min,max,label){
 if(!Number.isInteger(value)||value<min||value>max)fail('INVALID_FIELD',`${label} 必须是 ${min}～${max} 的整数`);
 return value;
}
export function checksum(bytes){let sum=0;for(let i=0x200;i<bytes.length;i+=2)sum=(sum+bytes[i]*256+(bytes[i+1]||0))&0xffff;return sum;}
