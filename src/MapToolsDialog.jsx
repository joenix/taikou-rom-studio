import ModalWindow from './ModalWindow.jsx';
import MapWorkspace from './MapWorkspace.jsx';
export default function MapToolsDialog({doc,revision,mode,onChange,onClose}){
 return <ModalWindow title="地图编辑" onClose={onClose} className="map-tools-dialog"><MapWorkspace embedded doc={doc} revision={revision} mode={mode} onChange={onChange}/></ModalWindow>;
}
