import {readWestLayout} from './west-layout.js';
import {u16,span,fail} from './codec.js';
import {readMapExtension} from './map-extension.js';
export function readTownInterior(bytes,id){
 const ext=readMapExtension(bytes),west=readWestLayout(bytes),count=west?.towns.town_count??(ext?18:17);
 if(!Number.isInteger(id)||id<0||id>=count)fail('INVALID_TOWN','町编号越界');
 const base=u16(bytes,(west?.towns.bases??ext?.bases??0x761c6)+id*2),cells=new Int16Array(32*24).fill(-1);
 for(let sy=0;sy<3;sy++)for(let sx=0;sx<4;sx++){
  const block=u16(bytes,(west?.towns.scene_index??0x764a8)+(base+sy*41+sx)*2);
  if(!block)continue;
  if(block<522||block> (west?521+west.towns.block_count:ext?737:725))fail('INVALID_TOWN','町内图块索引越界');
  const source=span(bytes,(west?.towns.interiors??ext?.interiors??0xcc22e)+(block-522)*64,64);
  for(let y=0;y<8;y++)for(let x=0;x<8;x++)cells[(sy*8+y)*32+sx*8+x]=source[y*8+x];
 }
 return {width:32,height:24,cells,base};
}
