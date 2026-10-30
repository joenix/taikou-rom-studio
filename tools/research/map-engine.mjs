// Experimental native-engine probe. Not imported by the browser editor.
import {createHash} from 'node:crypto';
import {readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {validateRom} from '../../src/rom/validate.js';
import {requireWorldMap,mapCoordinate,WORLD} from '../../src/rom/world-map.js';
import {checksum,fail} from '../../src/rom/codec.js';
const sha=b=>createHash('sha256').update(b).digest('hex');
const hex=n=>'0x'+n.toString(16);
export function buildEntranceExperiment(source){
 validateRom(source);requireWorldMap(source);
 const base=source.length,table=base,flags=base+21*8,bases=(flags+21+1)&~1;
 const bytes=new Uint8Array(bases+18*2);bytes.set(source);
 const patches=[];
 function patch(offset,expected,data){const before=source.slice(offset,offset+expected.length);if(Buffer.compare(Buffer.from(before),Buffer.from(expected)))fail('RESEARCH_SIGNATURE_MISMATCH',`实验指令不匹配 ${hex(offset)}`);bytes.set(data,offset);patches.push({offset:hex(offset),before:Buffer.from(before).toString('hex'),after:Buffer.from(data).toString('hex')});}
 const long=n=>[(n>>>24)&255,(n>>>16)&255,(n>>>8)&255,n&255];
 const word=(offset,n)=>bytes.set([n>>>8,n&255],offset);
 // Relocate all known direct users, including the return lookup whose base is table-8.
 for(const offset of [0xf958,0xf9a8,0xfa0e])patch(offset,long(0xd30da),long(table));
 patch(0xf932,long(0xd30d2),long(table-8));
 patch(0xfa4c,long(0xd317a),long(flags));
 for(const offset of [0xf9e6,0xfa60])patch(offset,[0,20],[0,21]);
 bytes.set(source.slice(WORLD.townEntrances,WORLD.townEntrances+160),table);
 bytes.set(source.slice(0xd317a,0xd317a+20),flags);bytes[flags+20]=bytes[flags];
 // Deliberately an additional entrance into an existing town, not a new town identity.
 let location;for(let y=8;y<184&&!location;y++)for(let x=8;x<320;x++){try{const c=mapCoordinate(source,x,y);if(source[c.offset]===19){location=c;break;}}catch{}}
 if(!location)fail('NO_PROBE_LOCATION','没有找到实验用地形');
 const entry=table+160;word(entry,location.mapId);bytes[entry+2]=location.localX;bytes[entry+3]=location.localY;bytes.set(source.slice(WORLD.townEntrances+4,WORLD.townEntrances+8),entry+4);bytes[location.offset]=0x40;
 // Independent classification probe: map 0x500 is intentionally not a playable scene.
 bytes.set(source.slice(WORLD.townBases,WORLD.townBases+34),bases);word(bases+34,0x500);
 patch(0x7486,long(WORLD.townBases),long(bases));patch(0x74bc,[0,17],[0,18]);
 patch(0x1a4,long(source.length-1),long(bytes.length-1));
 word(0x18e,checksum(bytes));validateRom(bytes);
 return {bytes,report:{experimental:true,playableRelease:false,sourceSha256:sha(source),outputSha256:sha(bytes),sourceLength:source.length,outputLength:bytes.length,table,flags,bases,location,entry:Buffer.from(bytes.slice(entry,entry+8)).toString('hex'),newTownClassifier:{id:17,map:0x500,sceneAllocated:false},patches,limitations:['第21个入口复用既有町内部，不能称为新增独立町','0x500 仅用于分类函数实验，未分配场景与商店','删除实验保持稳定ID，只停用入口，不处理旧存档与剧情','城池RAM布局、初始化和存档均未扩容']}};
}
export function buildDisableExperiment(source){
 validateRom(source);requireWorldMap(source);
 const bytes=new Uint8Array(source),entry=bytes.slice(WORLD.townEntrances,WORLD.townEntrances+8);
 const mapId=(entry[0]<<8)|entry[1],x=(mapId%41)*8+entry[2],y=Math.floor(mapId/41)*8+entry[3],location=mapCoordinate(source,x,y);
 bytes[WORLD.townEntrances]=255;bytes[WORLD.townEntrances+1]=255;bytes[location.offset]=19;
 const sum=checksum(bytes);bytes[0x18e]=sum>>>8;bytes[0x18f]=sum&255;validateRom(bytes);
 return {bytes,report:{experimental:true,mode:'disable',playableRelease:false,sourceSha256:sha(source),outputSha256:sha(bytes),entry:Buffer.from(entry).toString('hex'),townBase:(source[WORLD.townBases]<<8)|source[WORLD.townBases+1],location,fillCode:19,limitations:['仅停用第0町的入口','原生回程仍会得到0xffff，证明不能作为可交付删除方案']}};
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const [input,output,mode='add']=process.argv.slice(2);if(!input)throw new Error('用法: node tools/research/map-engine.mjs ROM [实验副本.bin]');
 if(output&&resolve(input)===resolve(output))throw new Error('实验不能覆盖原始 ROM');
 const original=new Uint8Array(await readFile(input)),result=mode==='disable'?buildDisableExperiment(original):mode==='add'?buildEntranceExperiment(original):(()=>{throw Error('模式必须为 add 或 disable');})();
 if(output)await writeFile(output,result.bytes,{flag:'wx'});
 console.log(JSON.stringify({...result.report,output:output||null},null,2));
}
