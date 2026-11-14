import {useState} from 'react';
import ModalWindow from './ModalWindow.jsx';
import MapWorkspace from './MapWorkspace.jsx';
import TownMapEditor from './TownMapEditor.jsx';
export default function MapToolsDialog({doc,revision,mode,worldMode=mode,onChange,onClose,initialTab='town',initialTown=17}){
 const [tab,setTab]=useState(initialTab);
 return <ModalWindow title="地图编辑" onClose={onClose} className="map-tools-dialog"><div className="town-editor-tools" role="tablist" aria-label="地图类型"><button role="tab" aria-selected={tab==='town'} className={'button '+(tab==='town'?'primary':'')} onClick={()=>setTab('town')}>町内地图</button><button role="tab" aria-selected={tab==='world'} className={'button '+(tab==='world'?'primary':'')} onClick={()=>setTab('world')}>大地图</button></div>{tab==='town'?<TownMapEditor doc={doc} revision={revision} mode={mode} onChange={onChange} initialTown={initialTown}/>:<MapWorkspace embedded doc={doc} revision={revision} mode={worldMode} onChange={onChange}/>}</ModalWindow>;
}
