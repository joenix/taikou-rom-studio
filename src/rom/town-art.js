import {decompressTaikoAsset} from './portraits.js';
import {span,u16,integer,fail} from './codec.js';
const cache=new WeakMap();
/** The original town bank and four seasonal palettes, read from the loaded ROM. */
export function loadTownArt(bytes,season=1){
 integer(season,0,3,'季节');
 let bank=cache.get(bytes);if(!bank){const at=u16(bytes,0xe6152)*65536+u16(bytes,0xe6154);bank=decompressTaikoAsset(span(bytes,at,Math.min(40000,bytes.length-at)),65536).bytes;cache.set(bytes,bank);}
 const palette=Array.from({length:16},(_,i)=>{const n=u16(bytes,0x8a6a0+season*32+i*2);return [((n>>>1)&7)*255/7,((n>>>5)&7)*255/7,((n>>>9)&7)*255/7];});
 const tiles=new Map();return {tile(code){integer(code,0,105,'町图块');if(tiles.has(code))return tiles.get(code);const first=(u16(bytes,0xcf61c+code*2)&2047)-0x2d2;if(first<0||(first+4)*32>bank.length)fail('INVALID_TOWN_ART','町图块原画引用越界');const pixels=new Uint8ClampedArray(1024);for(let y=0;y<16;y++)for(let x=0;x<16;x++){const v=bank[(first+(y>>>3)*2+(x>>>3))*32+(y&7)*4+((x&7)>>>1)],c=x&1?v&15:v>>>4;pixels.set([...palette[c],255],(y*16+x)*4);}tiles.set(code,pixels);return pixels;}};
}
