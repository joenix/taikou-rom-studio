import {readRomDirectory} from './rom-directory.js';
import {fail,span} from './codec.js';
export const OVERVIEW_COLORS=[0,1,2,3,4,5,6,7,8,10];
const word=(b,p)=>(b[p]<<8)|b[p+1];
const pack=p=>Uint8Array.from({length:32},(_,i)=>(p[i*2]<<4)|p[i*2+1]);
const unpack=b=>Uint8Array.from({length:64},(_,i)=>(b[i>>1]>>(i&1?0:4))&15);
const flipped=(p,h,v)=>Uint8Array.from({length:64},(_,i)=>p[(v?7-(i>>3):i>>3)*8+(h?7-(i&7):i&7)]);
const key=p=>Array.from(p).join(',');
function descriptor(bytes){
 const directory=readRomDirectory(bytes),d=directory?.manifest.resources.faction_overview;
 if(!d)fail('NO_OVERVIEW_EDITOR','此 ROM 未包含势力图绘制标记，请载入配套的新版 ROM');
 if(d.schema!=='faction-overview.paint.v1'||d.width!==80||d.height!==28||d.tile_size!==8||String(d.edit_rect)!=='0,0,128,224'||d.stock_first!==722||d.stock_count!==722||!Array.isArray(d.pattern_ids)||d.pattern_ids.length>80||new Set(d.pattern_ids).size!==d.pattern_ids.length)fail('INVALID_OVERVIEW','势力图资源标记不完整');
 const ranges=[[d.image_offset,4480],[d.pattern_bank_offset,d.pattern_ids.length*32],[d.stock_bank_offset,722*32],[d.stock_valid_offset,91],[d.palette_offset,32],[d.protection_offset,3584],[d.baseline_offset,14336]];
 if(!Array.isArray(d.page_offsets)||d.page_offsets.length!==2||!Array.isArray(d.stripe_offsets)||d.stripe_offsets.length!==2)fail('INVALID_OVERVIEW','势力图缓存标记不完整');
 ranges.push(...d.page_offsets.map(p=>[p,3584]),...d.stripe_offsets.map(p=>[p,896]));
 for(const [at,n] of ranges){if(!Number.isSafeInteger(at)||at<0x200||at+n>directory.payloadOffset)fail('INVALID_OVERVIEW','势力图资源范围越界');span(bytes,at,n);}
 for(let i=0;i<ranges.length;i++)for(let j=0;j<i;j++)if(ranges[i][0]<ranges[j][0]+ranges[j][1]&&ranges[j][0]<ranges[i][0]+ranges[i][1])fail('INVALID_OVERVIEW','势力图资源范围重叠');
 for(const id of d.pattern_ids)if(!Number.isInteger(id)||!(id>=1446&&id<1472||id>=1520&&id<1536||id>=722&&id<1344&&!stockValid(bytes,d,id)))fail('INVALID_OVERVIEW','自绘图案占用了受保护图形');
 return d;
}
function stockValid(b,d,id){const i=id-d.stock_first;return i>=0&&i<722&&Boolean(b[d.stock_valid_offset+(i>>3)]&(1<<(i&7)));}
export function overviewCapability(bytes){try{return {supported:true,descriptor:descriptor(bytes)};}catch(error){return {supported:false,error};}}
export function readOverview(bytes){
 const d=descriptor(bytes),patterns=new Map();
 for(let i=0;i<722;i++)if(stockValid(bytes,d,i+722))patterns.set(i+722,unpack(span(bytes,d.stock_bank_offset+i*32,32)));
 d.pattern_ids.forEach((id,i)=>patterns.set(id,unpack(span(bytes,d.pattern_bank_offset+i*32,32))));
 const pixels=new Uint8Array(640*224),attrs=new Uint16Array(2240),fixed=new Set(d.frozen_pattern_ids||[]);
 if([...fixed].some(id=>!d.pattern_ids.includes(id)))fail('INVALID_OVERVIEW','共享图案保护标记异常');
 for(let ty=0;ty<28;ty++)for(let tx=0;tx<80;tx++){
  const a=word(bytes,d.image_offset+(ty*80+tx)*2),id=a&2047;attrs[ty*80+tx]=a;
  if(!patterns.has(id))fail('INVALID_OVERVIEW','势力图引用了未知图案');
  const p=flipped(patterns.get(id),a&2048,a&4096);
  if(tx>=16&&d.pattern_ids.includes(id))fixed.add(id);
  for(let y=0;y<8;y++)pixels.set(p.subarray(y*8,y*8+8),(ty*8+y)*640+tx*8);
 }
 const protectedPixel=(x,y)=>x<0||x>=128||y<0||y>=224||Boolean(bytes[d.protection_offset+((y*128+x)>>3)]&(1<<((y*128+x)&7)));
 for(let y=0;y<224;y++)for(let x=0;x<128;x++)if([11,13].includes(pixels[y*640+x])&&!protectedPixel(x,y))fail('INVALID_OVERVIEW','城点或道路保护数据不完整');
 const palette=Array.from({length:16},(_,i)=>{const v=word(bytes,d.palette_offset+i*2);return [((v>>1)&7)*255/7,((v>>5)&7)*255/7,((v>>9)&7)*255/7].map(Math.round);});
 const used=new Set([...attrs].map(a=>a&2047).filter(id=>d.pattern_ids.includes(id)&&!fixed.has(id)));
 return {descriptor:d,width:640,height:224,pixels,attrs,patterns,fixed,protectedPixel,palette,usedPatterns:used.size,capacity:d.pattern_ids.length-fixed.size};
}
export function overviewPatches(bytes,cells){
 if(!Array.isArray(cells)||cells.length>128*224)fail('INVALID_OVERVIEW_EDIT','每次最多绘制一张西端底图');
 const m=readOverview(bytes),d=m.descriptor,pixels=m.pixels.slice();let changed=false;
 for(const c of cells){if(!Number.isInteger(c.x)||!Number.isInteger(c.y)||m.protectedPixel(c.x,c.y))fail('PROTECTED_OVERVIEW','原版地图、城点及连接线受保护');if(!OVERVIEW_COLORS.includes(c.color))fail('INVALID_OVERVIEW_COLOR','请选择原版底图颜色');const i=c.y*640+c.x;if(pixels[i]!==c.color){pixels[i]=c.color;changed=true;}}
 if(!changed)return [];
 const dictionary=new Map(),add=(id,p)=>{for(let v=0;v<2;v++)for(let h=0;h<2;h++){const k=key(flipped(p,h,v));if(!dictionary.has(k))dictionary.set(k,id|(h?2048:0)|(v?4096:0));}};
 for(const [id,p] of m.patterns)if(!d.pattern_ids.includes(id)||m.fixed.has(id))add(id,p);
 const available=d.pattern_ids.filter(id=>!m.fixed.has(id)),allocated=new Map(),attrs=m.attrs.slice();let used=0;
 for(let y=0;y<28;y++)for(let x=0;x<16;x++){
  const p=Uint8Array.from({length:64},(_,i)=>pixels[(y*8+(i>>3))*640+x*8+(i&7)]),k=key(p);
  if(!dictionary.has(k)){if(used>=available.length)fail('OVERVIEW_PATTERN_LIMIT','自绘图案种类已满：请用原版图块或重复纹理简化。本次笔画未写入。');const id=available[used++];allocated.set(id,pack(p));add(id,p);}
  attrs[y*80+x]=(m.attrs[y*80+x]&0xe000)|dictionary.get(k);
 }
 const proposed=new Map(),set=(at,data)=>data.forEach((v,i)=>{if(bytes[at+i]!==v)proposed.set(at+i,v);});
 d.pattern_ids.forEach((id,i)=>{if(!m.fixed.has(id))set(d.pattern_bank_offset+i*32,allocated.get(id)||new Uint8Array(32));});
 for(let y=0;y<28;y++)for(let x=0;x<16;x++){const a=attrs[y*80+x],data=[a>>>8,a&255];set(d.image_offset+(y*80+x)*2,data);set(d.page_offsets[0]+(y*64+x)*2,data);set(d.stripe_offsets[0]+(y*16+x)*2,data);}
 return [...proposed].sort((a,b)=>a[0]-b[0]).map(([offset,after])=>({offset,before:bytes[offset],after}));
}
export function overviewTiles(model,group){
 const d=model.descriptor;return [...model.patterns].filter(([id,p])=>id>=722&&id<=1443&&!d.pattern_ids.includes(id)&&[...p].every(v=>OVERVIEW_COLORS.includes(v))).filter(([,p])=>group==='sea'?[...p].every(v=>[2,8,10].includes(v)):group==='land'?[...p].every(v=>[1,4,6].includes(v)):[...p].some(v=>[2,8,10].includes(v))&&[...p].some(v=>[1,4,5,6,7].includes(v))).map(([id,pixels])=>({id,pixels}));
}
