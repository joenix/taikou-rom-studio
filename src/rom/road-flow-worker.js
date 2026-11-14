import {buildRoadFlowTables,installRoadFlowTables} from './road-flow-build.js';
self.onmessage=({data})=>{try{const built=buildRoadFlowTables(data.bytes,progress=>self.postMessage({progress}));const bytes=installRoadFlowTables(data.bytes,built);self.postMessage({bytes},[bytes.buffer]);}catch(error){self.postMessage({error:{code:error.code??'ROAD_BUILD_FAILED',message:error.message}});}};
