import {decompressTaikoAsset} from './portraits.js';
import {span,u16,fail} from './codec.js';
const long=(b,p)=>u16(b,p)*65536+u16(b,p+2);
export const WORLD_ART={tilesPointer:0xe614e,tileBase:0x2d2,terrainTable:0xcf52e,castleTable:0xcf5dc,palettes:0x8a5a0};
/** Original D37E layout: four consecutive 8×8 tiles, palette bank 1. */
export function stampAttributes(target,x,y,tile,coverage){for(let dy=0;dy<2;dy++)for(let dx=0;dx<2;dx++){const index=((y*2+dy)&31)*32+((x*2+dx)&31);target[index]=(tile+dy*2+dx)|0x2000;coverage?.add(index);}}
/** Original D426 redraw against a runtime cache; used for independent evidence comparison. */
export function redrawWorldAttributes(rom,ram,coverage){
 const out=Array.from({length:1024},(_,i)=>u16(ram,0xcfb0+i*2));
 const viewX=u16(ram,0xcafc),viewY=u16(ram,0xd7cc),sx=(ram[6]*8+viewX+4)%16,sy=(ram[7]*8+viewY+3)%16;
 for(let y=0;y<14;y++)for(let x=0;x<15;x++){
  const code=ram[0xb7c3+(viewY+y)*24+viewX+x],px=sx+x,py=sy+y;
  if(code&128){const p=WORLD_ART.castleTable+((code>>>4)&7)*8+((code&8)?2:0);stampAttributes(out,px,py-1,u16(rom,p),coverage);stampAttributes(out,px,py,u16(rom,p+4),coverage);}
  else stampAttributes(out,px,py,u16(rom,WORLD_ART.terrainTable+code*2),coverage);
 }
 return out;
}
export function loadWorldArt(rom,season=1){
 if(!Number.isInteger(season)||season<0||season>3)fail('INVALID_MAP_ART','地图季节超出范围');
 // Fingerprints of the verified renderer/table lookup and compressed world bank.
 if(long(rom,0xd432)!==0xcf5dc||long(rom,0xd4a8)!==0xcf52e)fail('INVALID_MAP_ART','原画映射读取指令不匹配');
 const at=long(rom,WORLD_ART.tilesPointer),result=decompressTaikoAsset(span(rom,at,Math.min(20000,rom.length-at)),16384);
 if(result.bytes.length!==11264)fail('INVALID_MAP_ART','大地图原画图块数量不匹配');
 const palette=Array.from({length:16},(_,i)=>{const n=u16(rom,WORLD_ART.palettes+season*32+i*2);return [((n>>>1)&7)*255/7,((n>>>5)&7)*255/7,((n>>>9)&7)*255/7];});
 const cache=new Map();
 function cell(tile){
  if(cache.has(tile))return cache.get(tile);
  const first=(tile&0x7ff)-WORLD_ART.tileBase;
  if(first<0||first+4>352)fail('INVALID_MAP_ART','地图图块引用越界');
  const pixels=new Uint8ClampedArray(16*16*4);
  for(let y=0;y<16;y++)for(let x=0;x<16;x++){
   const t=first+(y>>>3)*2+(x>>>3),v=result.bytes[t*32+(y&7)*4+((x&7)>>>1)],n=x&1?v&15:v>>>4;
   pixels.set([...palette[n],255],(y*16+x)*4);
  }
  cache.set(tile,pixels);return pixels;
 }
 return {cell,terrain:code=>cell(u16(rom,WORLD_ART.terrainTable+code*2)),castle:(style,part)=>cell(u16(rom,WORLD_ART.castleTable+style*8+part*2)),tileBytes:result.bytes,palette};
}
/** One full static map, with castle size read from original initial-state records. */
export function paintWorldArt(ctx,rom,map,season=1){
 const art=loadWorldArt(rom,season),image=ctx.createImageData(16,16);
 function stamp(pixels,x,y){image.data.set(pixels);ctx.putImageData(image,x*16,y*16);}
 ctx.fillStyle='#71809a';ctx.fillRect(0,0,328*16,192*16);
 for(let y=0;y<192;y++)for(let x=0;x<328;x++){
  const code=map.cells[y*328+x];if(code<0)continue;
  // Castle bottom cells are replaced in the second pass, after surrounding terrain.
  if(code<128)stamp(art.terrain(code),x,y);
 }
 for(const p of map.places.castles){const style=(rom[0x7aab8+p.id*18+15]&3)|4;for(let part=0;part<4;part++)stamp(art.castle(style,part),p.x+(part&1),p.y-1+(part>>>1));}
 return art;
}
