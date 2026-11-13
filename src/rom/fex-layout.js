import {fail} from './codec.js';
export const FEX142={version:'1.42',title:'TAIKOU PRO V1.42 FACTION BASE',payloadSize:0x804,
 factionCount:18,factionStart:0,factionStride:34,castleStart:0x264,castleCount:36,castleStride:18,
 oldToNewRelations:0x4ec,newToNewRelations:0x654,leaderIds:0x798,governorIds:0x7bc};
export function factionExpansionLayout(resource){
 if(!resource||resource.schema==='fex1.payload.v1')return FEX142;
 const bad=()=>fail('INVALID_FEX142','FEX 动态布局声明无效');
 if(resource.schema!=='fex1.payload.v2'||!resource.layout)bad();
 const l={...FEX142,...resource.layout};
 const keys=['payloadSize','factionCount','factionStart','factionStride','castleStart','castleCount','castleStride','oldToNewRelations','newToNewRelations','leaderIds','governorIds'];
 if(keys.some(k=>!Number.isSafeInteger(l[k])||l[k]<0)||l.payloadSize!==resource.length||l.payloadSize>0xfe0||
    l.factionCount!==18||l.factionStride!==34||l.castleStride!==18||l.castleCount<36||123+l.castleCount>255)bad();
 const spans=[[l.factionStart,l.factionCount*34],[l.castleStart,l.castleCount*18],
  [l.oldToNewRelations,20*18],[l.newToNewRelations,18*18],[l.leaderIds,18*2],[l.governorIds,l.castleCount*2]];
 for(let i=0;i<spans.length;i++){const [p,n]=spans[i];if(p+n>l.payloadSize)bad();
  for(let j=0;j<i;j++){const [q,m]=spans[j];if(p<q+m&&q<p+n)bad();}}
 return l;
}
