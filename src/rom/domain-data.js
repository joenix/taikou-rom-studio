import {u16,integer,fail} from './codec.js';
export const CASTLE_STATE=0x7aab8,FACTION_STATE=0x85a7a;
export const RELATIONS=['盟友','親密','良好','通常','敵視','敵対','交戦'];
export const CASTLE_FIELDS=[
 {key:'kokudaka',label:'石高（万石）',offset:3,max:255,step:1},
 {key:'control',label:'统治（％）',offset:4,max:100,step:1},
 {key:'funds',label:'资金（贯）',offset:6,max:300000,step:10,word:true,unit:10},
 {key:'rice',label:'兵粮（石）',offset:8,max:300000,step:10,word:true,unit:10},
 {key:'guns',label:'铁炮（丁）',offset:10,max:25500,step:100,unit:100},
 {key:'horses',label:'骑马（头）',offset:11,max:25500,step:100,unit:100},
 {key:'soldiers',label:'兵士（人）',offset:12,max:30000,step:1,word:true},
 {key:'morale',label:'士气（％）',offset:14,max:100,step:1},
 {key:'size',label:'城池规模',offset:15,max:3,step:1,mask:3},
];
export function castleRuntimeId(bytes,id){
 if(id<123)return id;
 const p=0x77952+id*20;for(let i=0;i<123;i++){const q=0x77952+i*20;if([14,15,16,17].every(j=>bytes[p+j]===bytes[q+j]))return i;}return null;
}
export function readCastleState(bytes,id){const runtimeId=castleRuntimeId(bytes,id);if(runtimeId===null)return null;const p=CASTLE_STATE+runtimeId*18,out={runtimeId,offset:p,governorId:bytes[p+1],factionId:bytes[p+2]};for(const f of CASTLE_FIELDS){const raw=f.word?u16(bytes,p+f.offset):bytes[p+f.offset];out[f.key]=(f.mask===undefined?raw:raw&f.mask)*(f.unit||1);}return out;}
export function castleFieldBytes(bytes,state,key,value){const f=CASTLE_FIELDS.find(f=>f.key===key);if(!f)fail('UNSUPPORTED_FIELD','城池字段未开放');integer(value,0,f.max,f.label);if(value%f.step)fail('INVALID_FIELD',`${f.label}须为${f.step}的整数倍`);const raw=value/(f.unit||1),p=state.offset+f.offset;return {offset:p,data:f.word?[raw>>>8,raw&255]:[f.mask===undefined?raw:(bytes[p]&~f.mask)|raw]};}
export function readFactionState(bytes,id){if(id<0||id>=20)return null;const p=FACTION_STATE+id*34;return {offset:p,active:bytes[p]!==0&&bytes[p]!==255,leaderId:bytes[p],homeCastleId:bytes[p+21],relations:Array.from({length:20},(_,target)=>{const raw=bytes[p+1+target],code=raw&7;return {target,raw,code,label:RELATIONS[code]||'未核实关系',treatyCode:(raw>>>4)&3,treaty:['－','盟','属','未核实'][raw>>>4&3],marriageBit:!!(raw&8)};})};}
