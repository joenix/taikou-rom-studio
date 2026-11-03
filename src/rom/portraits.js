import {span,u16,integer,fail} from './codec.js';
export function decompressTaikoAsset(input, maxBytes=4096){
 if (!(input instanceof Uint8Array)||input.length<4||input.length>65536)throw new Error('压缩资源格式或长度不正确');
 let cursor=0,available=0,word=0,rolling=0,flags=0,groups=0,tokens=0;
 const result=[];
 function read(n){
  if(!Number.isInteger(n)||n<1||n>16)throw new Error('无效的位流长度');
  rolling=(rolling<<n)&0xffff;
  if(n>available){
   const rest=n-available;
   rolling|=((word&((1<<available)-1))<<rest)&0xffff;
   if(cursor+1>=input.length)throw new Error('资源位流提前结束');
   word=(input[cursor+1]<<8)|input[cursor];cursor+=2;
   available=16-rest;
   rolling|=(word>>>available)&((1<<rest)-1);
  }else{
   available-=n;
   rolling|=(word>>>available)&((1<<n)-1);
  }
 }
 read(16);
 for(;;){
  if(cursor>=input.length)throw new Error('资源控制字节提前结束');
  flags=input[cursor++];groups++;
  for(let k=0;k<8;k++){
   tokens++;
   if(flags&0x80){
    if(cursor>=input.length)throw new Error('字面量越界');
    result.push(input[cursor++]);
   }else{
    const x=rolling;let length,bitCount;
    if(x&0x8000){length=1;bitCount=0;}
    else if(x&0x4000){length=(x&0x6000)>>>13;bitCount=2;}
    else if(x&0x2000){length=(x&0x3800)>>>11;bitCount=4;}
    else if(x&0x1000){length=(x&0x1e00)>>>9;bitCount=6;}
    else if(x&0x0800){length=(x&0x0f80)>>>7;bitCount=8;}
    else if(x&0x0400){length=(x&0x07e0)>>>5;bitCount=10;}
    else if(x&0x0200){length=(x&0x03f8)>>>3;bitCount=12;}
    else{
     length=((x&0x01fc)>>>2)+128;
     if(length===255)return {bytes:Uint8Array.from(result),bytesRead:cursor,unused:input.length-cursor,groups,tokens,terminated:true};
     bitCount=13;
    }
    if(bitCount)read(bitCount);
    rolling&=0x7fff;
    const s=rolling;let distanceIndex,offsetBits;
    if(s<0x0800){distanceIndex=(s&0x0600)>>>9;offsetBits=7;}
    else if(s<0x0c00){distanceIndex=((s&0x0300)>>>8)+4;offsetBits=8;}
    else if(s<0x1800){distanceIndex=((((s-0x0c00)>>>0)&0x0f80)>>>7)+8;offsetBits=9;}
    else if(s<0x3000){distanceIndex=((((s-0x1800)>>>0)&0x1fc0)>>>6)+32;offsetBits=10;}
    else if(s<0x4000){distanceIndex=((s&0x1fff)|0x1000)>>>5;offsetBits=11;}
    else if(s<0x5000){distanceIndex=((s&0x1fff)|0x1000)>>>4;offsetBits=12;}
    else if(s<0x6000){distanceIndex=((s&0x1fff)|0x1000)>>>3;offsetBits=13;}
    else if(s<0x7000){distanceIndex=((s&0x1fff)|0x1000)>>>2;offsetBits=14;}
    else{distanceIndex=((s&0x1fff)|0x1000)>>>1;offsetBits=15;}
    read(offsetBits);
    const distance=distanceIndex+1;
    if(distance>result.length)throw new Error(`非法反向引用：距离 ${distance}，输出 ${result.length}`);
    for(let i=0;i<=length;i++){
     if(result.length>=maxBytes)throw new Error('解压后数据超出容量保护');
     result.push(result[result.length-distance]);
    }
   }
   if(result.length>maxBytes)throw new Error('解压后数据超出容量保护');
   flags=(flags<<1)&255;
  }
 }
}
/** Mega Drive tile layout: one 8x8x4bpp tile = 32 bytes, row-major tiles. */
export function unpackTaikoTiles(bytes,columns){
 if(!(bytes instanceof Uint8Array)||bytes.length===0||bytes.length%32!==0)throw new Error('资源长度不是完整图块');
 const tiles=bytes.length/32;
 if(!Number.isInteger(columns)||columns<1||tiles%columns!==0)throw new Error('图块列数与资源尺寸不符');
 const rows=tiles/columns,width=columns*8,height=rows*8,indices=new Uint8Array(width*height);
 for(let t=0;t<tiles;t++)for(let y=0;y<8;y++)for(let x=0;x<8;x++){
  const value=bytes[t*32+y*4+(x>>>1)];indices[((t/columns|0)*8+y)*width+(t%columns)*8+x]=(x&1)?value&15:value>>>4;
 }
 return {width,height,columns,rows,indices};
}
const WORD=(bytes,p)=>(bytes[p]<<8)|bytes[p+1];
const LONG=(bytes,p)=>(bytes[p]*0x1000000+((bytes[p+1]<<16)|(bytes[p+2]<<8)|bytes[p+3]))>>>0;
function assembleCompositePortrait(rom,raw){
 if(!(rom instanceof Uint8Array)||rom.length<0x126e84)throw new Error('合成画像要求完整 PRO v1.3 ROM');
 if(!Number.isInteger(raw)||raw<0x8000||raw>0xffff)throw new Error('画像编码不属于合成类型');
 const family=(raw>>>8)&15,variation=raw&255;
 if(family>11)throw new Error('合成组别超过游戏绘制器允许范围');
 const selectors=[(variation>>>6)&3,(variation>>>4)&3,(variation>>>2)&3,(variation>>>2)&3,variation&3];
 const tileBytes=new Uint8Array(20*32),parts=[];
 // ROM code 0xE192, 0xE1BC, 0xE1E4, 0xE20E, 0xE23A.
 for(const part of [4,0,1,2,3]){
  const coordinate=0xD2FBE+family*20+part*4;
  const destination=WORD(rom,coordinate),tiles=WORD(rom,coordinate+2);
  const sourcePointer=0xD2BFE+family*80+part*16+selectors[part]*4;
  const source=LONG(rom,sourcePointer),length=tiles*32;
  if(tiles===0||destination+tiles>20||source<0x10B3E0||source+length>0x126E84)throw new Error(`合成组件 ${part} 指针/长度越界`);
  tileBytes.set(rom.subarray(source,source+length),destination*32);
  parts.push({part,variant:selectors[part],source,destinationTile:destination,tileCount:tiles});
 }
 return {raw,family,variation,bytes:tileBytes,parts,image:unpackTaikoTiles(tileBytes,4)};
}

export function validatePortraitSelector(raw){
 integer(raw,0,65535,'头像引用');
 if(raw<0x8000&&raw>=258||raw>=0x8000&&((raw>>>8)&15)>11)fail('INVALID_PORTRAIT','头像引用超出已支持的内置资源');
 return raw;
}
export function portraitImage(rom,selector){
 validatePortraitSelector(selector);let image;
 if(selector&0x8000)image=assembleCompositePortrait(rom,selector).image;
 else{
  const p=0x10afd8+selector*4;span(rom,p,4);const at=LONG(rom,p),end=selector===257?0x10afd8:LONG(rom,p+4);
  if(at<0xf039c||end<=at||end>0x10afd8)fail('INVALID_PORTRAIT','头像资源指针异常');
  image=unpackTaikoTiles(decompressTaikoAsset(span(rom,at,end-at)).bytes,4);
 }
 if(image.width!==32||image.height!==40)fail('INVALID_PORTRAIT','头像尺寸不匹配');
 const colors=Array.from({length:16},(_,i)=>{const word=u16(rom,0x8a2c0+i*2);return [((word>>>1)&7)*255/7,((word>>>5)&7)*255/7,((word>>>9)&7)*255/7];});
 return {...image,colors};
}
