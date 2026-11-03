import {itemIconTable} from './item-icons.js';
import {span,u16,integer,encodeField,fail} from './codec.js';
import {WORLD,requireWorldMap,mapCoordinate,readMapPlaces} from './world-map.js';
import {readMapExtension,writeMapExtension,EXTENSION_MANIFEST_SIZE} from './map-extension.js';
// One independent town uses the 12 unused sectors in the original 41×30 scene grid.
// No castle RAM is expanded. The extra merchant-state byte is existing saved header padding FF003F.
const BASE=0x46f,NEW_ID=17;
export const TOWN_ENGINE_PATCHES=[
 ...[0xf958,0xf9a8,0xfa0e].map(offset=>({offset,expected:0xd30da,target:'entries'})),
 ...[0xf2d6,0xf932,0xfada,0xfb00,0x100a2,0x1022a,0x102cc,0x1064c].map(offset=>({offset,expected:0xd30d2,target:'entryHeader'})),
 {offset:0xfa4c,expected:0xd317a,target:'entryFlags'},
 {offset:0x7486,expected:0x761c6,target:'bases'},
 {offset:0x18dee,expected:0x75d36,target:'names'},
 {offset:0x3518a,expected:0x75d32,target:'nameHeader'},
 {offset:0xc1ce,expected:0xcc22e,target:'interiors'},
 {offset:0x4e286,expected:0xd6918,target:'trade'},
 {offset:0x1e8ea,expected:0xd3622,target:'prices'},
 {offset:0x31160,expected:0xd3a6e,target:'merchantSeeds'},
];
export const TOWN_ENGINE_COUNTS=[
 [0xf9e6,20,21],[0xfa60,20,21],[0x74bc,17,18],[0x17d60,17,18],[0x157ea,17,18],[0x30aac,17,18],[0x3118c,17,18],[0x31192,17,18],[0x5518e,17,18],[0x18dd4,17,18],
];
const value32=(b,p)=>u16(b,p)*65536+u16(b,p+2);
function set32(b,p,n){b.set([n>>>24,(n>>>16)&255,(n>>>8)&255,n&255],p);}
function set16(b,p,n){b[p]=n>>>8;b[p+1]=n&255;}
function exitGuardCode(meta){
 const out=[];const add=h=>out.push(...h.match(/../g).map(x=>parseInt(x,16))),long=n=>out.push(n>>>24,(n>>>16)&255,(n>>>8)&255,n&255);
 add('48e7fffe207900ffb584302800022f004eb90000746e588f0280000000ff0c4000116600');const branch=out.length;out.push(0,0);
 add('207c');long(meta.entries+17*8);add('33d000ff4bd670001028000233c000ff4bd81028000333c000ff4bda');
 const restore=out.length,delta=restore-branch;out[branch]=delta>>>8;out[branch+1]=delta&255;add('4cdf7fff13fc000100ff00094e75');return Uint8Array.from(out);
}
function checkExitHooks(bytes,meta){for(const p of [0x352c4,0x35322]){const expected=meta?[0x4e,0xb9,meta.exitGuard>>>24,(meta.exitGuard>>>16)&255,(meta.exitGuard>>>8)&255,meta.exitGuard&255,0x4e,0x71]:[0x13,0xfc,0,1,0,0xff,0,9];if(expected.some((v,i)=>bytes[p+i]!==v))fail('UNSUPPORTED_TOWN_ENGINE','玩家出町路径不匹配',{offset:p});}if(meta){const code=exitGuardCode(meta);if(code.some((v,i)=>bytes[meta.exitGuard+i]!==v))fail('INVALID_TOWN_ENGINE','玩家回程守卫损坏');}}
export function townEngineCapability(bytes){
 try{const ext=readMapExtension(bytes);if(ext){verifyTownEngine(bytes,ext);return {supported:true,installed:true,active:ext.active,capacity:1};}
  requireWorldMap(bytes);checkExitHooks(bytes,null);for(const p of TOWN_ENGINE_PATCHES)if(value32(bytes,p.offset)!==p.expected)fail('UNSUPPORTED_TOWN_ENGINE',`新增町适配不匹配：0x${p.offset.toString(16)}`);
  for(const [p,before]of TOWN_ENGINE_COUNTS)if(u16(bytes,p)!==before)fail('UNSUPPORTED_TOWN_ENGINE','新增町循环指令不匹配',{offset:p});
  for(let bank=0;bank<3;bank++)for(let part=0;part<4;part++)if(u16(bytes,WORLD.indexBase+(BASE+bank*41+part)*2)!==0)fail('TOWN_SCENE_SPACE_USED','新增町场景空间已被占用');
  return {supported:true,installed:false,active:false,capacity:1};
 }catch(error){return {supported:false,error:{code:error.code,message:error.message}};}
}
export function verifyTownEngine(bytes,meta){
 const layout=allocation(meta.originalLength);const iconTable=itemIconTable(bytes),iconInsertion=iconTable!==null&&iconTable-16===layout.manifestOffset?316:0;if(bytes.length!==layout.length+iconInsertion)fail('INVALID_TOWN_ENGINE','地图扩展大小异常');for(const key of ['entries','entryFlags','bases','names','nameText','interiors','trade','prices','merchantSeeds','exitGuard','manifestOffset'])if(meta[key]!==layout[key]+(key==='manifestOffset'?iconInsertion:0))fail('INVALID_TOWN_ENGINE','地图扩展布局异常',{field:key});
 checkExitHooks(bytes,meta);const targets={...meta,entryHeader:meta.entries-8,nameHeader:meta.names-4};
 for(const p of TOWN_ENGINE_PATCHES)if(value32(bytes,p.offset)!==targets[p.target])fail('INVALID_TOWN_ENGINE','地图扩展指令或指针损坏',{offset:p.offset});
 for(const [p,,after]of TOWN_ENGINE_COUNTS)if(u16(bytes,p)!==after)fail('INVALID_TOWN_ENGINE','地图扩展数量损坏',{offset:p});
 if(u16(bytes,meta.bases+34)!==BASE)fail('INVALID_TOWN_ENGINE','新增町场景族损坏');
 for(let bank=0;bank<3;bank++)for(let part=0;part<4;part++)if(u16(bytes,WORLD.indexBase+(BASE+bank*41+part)*2)!==726+bank*4+part)fail('INVALID_TOWN_ENGINE','新增町场景索引损坏');
}
function footprint(bytes,x,y,ignore){const cell=mapCoordinate(bytes,x,y);if(bytes[cell.offset]>=64&&cell.offset!==ignore)fail('LOCATION_CONFLICT','此格已被城、町或特殊入口占用');return cell;}
function checkDraft(draft,allowed){for(const k of Object.keys(draft))if(!allowed.includes(k))fail('UNSUPPORTED_FIELD',`未支持字段 ${k}`);}
function allocation(originalLength){let cursor=originalLength;const alloc=n=>{cursor=(cursor+1)&~1;const p=cursor;cursor+=n;return p;};const entryHeader=alloc(8+21*8),entries=entryHeader+8,entryFlags=alloc(21),bases=alloc(36),nameHeader=alloc(4+72),names=nameHeader+4,nameText=alloc(26),interiors=alloc(216*64),trade=alloc(18),prices=alloc(18),merchantSeeds=alloc(18),exitGuard=alloc(128),manifestOffset=alloc(EXTENSION_MANIFEST_SIZE);return {entryHeader,entries,entryFlags,bases,nameHeader,names,nameText,interiors,trade,prices,merchantSeeds,exitGuard,manifestOffset,length:cursor+16};}
export function createIndependentTown(source,draft){
 checkDraft(draft,['name','x','y']);const capability=townEngineCapability(source);if(!capability.supported)fail(capability.error.code,capability.error.message);
 const old=readMapExtension(source);if(old)fail('TOWN_CAPACITY','本版本最多新增一个独立町；停用后请恢复原町');
 integer(draft.x,0,327,'地图 X');integer(draft.y,0,191,'地图 Y');const cell=footprint(source,draft.x,draft.y);
 const name=encodeField(draft.name,24,new Uint8Array(24));
 const layout=allocation(source.length),{entryHeader,entries,entryFlags,bases,nameHeader,names,nameText,interiors,trade,prices,merchantSeeds,exitGuard,manifestOffset}=layout;
 const bytes=new Uint8Array(layout.length);bytes.set(source);
 bytes.set(span(source,0xd30d2,8),entryHeader);
 bytes.set(span(source,WORLD.townEntrances,17*8),entries);bytes.set(span(source,WORLD.townEntrances+17*8,3*8),entries+18*8);
 bytes.set(span(source,0xd317a,17),entryFlags);bytes[entryFlags+17]=source[0xd317a];bytes.set(span(source,0xd317a+17,3),entryFlags+18);
 bytes.set(span(source,WORLD.townBases,34),bases);set16(bytes,bases+34,BASE);
 bytes.set(span(source,0x75d32,4+17*4),nameHeader);set32(bytes,names+17*4,nameText);bytes.set(name,nameText);
 bytes.set(span(source,0xcc22e,204*64),interiors);bytes.set(span(source,0xcc22e,12*64),interiors+204*64);
 for(let bank=0;bank<3;bank++)for(let part=0;part<4;part++)set16(bytes,WORLD.indexBase+(BASE+bank*41+part)*2,726+bank*4+part);
 for(const [target,original]of [[trade,0xd6918],[prices,0xd3622],[merchantSeeds,0xd3a6e]]){bytes.set(span(source,original,17),target);bytes[target+17]=source[original];}
 const target=source.slice(WORLD.townEntrances+4,WORLD.townEntrances+8);const oldMap=u16(source,WORLD.townEntrances+4);set16(target,0,BASE+oldMap-u16(source,WORLD.townBases));
 const e=entries+17*8;set16(bytes,e,cell.mapId);bytes[e+2]=cell.localX;bytes[e+3]=cell.localY;bytes.set(target,e+4);bytes[cell.offset]=0x40;
 const meta={version:1,newTownId:NEW_ID,newTownBase:BASE,originalLength:source.length,active:true,entries,entryFlags,bases,names,nameText,interiors,trade,prices,merchantSeeds,exitGuard,template:0,fallbackTown:0,initialTerrain:source[cell.offset]};
 const targets={...meta,entryHeader,nameHeader};for(const p of TOWN_ENGINE_PATCHES)set32(bytes,p.offset,targets[p.target]);for(const [p,,after]of TOWN_ENGINE_COUNTS)set16(bytes,p,after);
 bytes.set(exitGuardCode(meta),exitGuard);for(const p of [0x352c4,0x35322]){bytes.set([0x4e,0xb9],p);set32(bytes,p+2,exitGuard);bytes.set([0x4e,0x71],p+6);}
 set32(bytes,0x1a4,bytes.length-1);writeMapExtension(bytes,meta,manifestOffset);verifyTownEngine(bytes,readMapExtension(bytes));
 return {bytes,label:`新增独立町 · ${draft.name}`};
}
export function setTownActive(source,active,draft){
 checkDraft(draft,active?['x','y','name']:['fillCode','fallbackTown']);const meta=readMapExtension(source);if(!meta)fail('NO_EDITOR_TOWN','没有编辑器新增的町');verifyTownEngine(source,meta);if(meta.active===active)fail('INVALID_TOWN_STATE','町的启用状态没有变化');
 const bytes=source.slice(),e=meta.entries+17*8;
 if(active){integer(draft.x,0,327,'地图 X');integer(draft.y,0,191,'地图 Y');const cell=footprint(source,draft.x,draft.y);set16(bytes,e,cell.mapId);bytes[e+2]=cell.localX;bytes[e+3]=cell.localY;bytes[cell.offset]=0x40;if(draft.name!==undefined)bytes.set(encodeField(draft.name,24,span(source,meta.nameText,24)),meta.nameText);meta.initialTerrain=source[cell.offset];}
 else{const refs=[];for(let id=0;id<713;id++){const p=0x7b35e+id*60;if([u16(source,p+2),u16(source,p+10)].some(mid=>[0,41,82].some(bank=>mid>=BASE+bank&&mid<BASE+bank+4)))refs.push(id);}if(refs.length)fail('TOWN_REFERENCED','初始人物位置或目标仍引用此町，必须先迁移后再删除',{records:refs});integer(draft.fillCode,0,63,'原址回填地形');integer(draft.fallbackTown,0,16,'迁移目标町');const places=readMapPlaces(source),place=places.towns.find(p=>p.id===17),target=places.towns.find(p=>p.id===draft.fallbackTown);if(!place||!target)fail('INVALID_MAP_PLACE','找不到迁移目的地');const cell=mapCoordinate(source,place.x,place.y);bytes[cell.offset]=draft.fillCode;const fallback=target.entrances[0];set16(bytes,e,fallback.mapId);bytes[e+2]=fallback.localX;bytes[e+3]=fallback.localY;meta.fallbackTown=draft.fallbackTown;}
 meta.active=active;writeMapExtension(bytes,meta,meta.manifestOffset);return {bytes,label:`${active?'恢复':'停用'}新增町`};
}
