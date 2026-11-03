import {useEffect,useId,useRef} from 'react';
import {X} from 'lucide-react';
export default function ModalWindow({title,onClose,actions,children,className=''}){
 const ref=useRef(null),id=useId();
 useEffect(()=>{const dialog=ref.current;dialog.showModal();return()=>dialog.close();},[]);
 return <dialog ref={ref} className={`edit-dialog modal-window ${className}`} aria-labelledby={id} onCancel={e=>{e.preventDefault();onClose();}}><div className="modal-window-top"><h2 id={id}>{title}</h2><div>{actions}<button type="button" className="icon-button" aria-label="关闭弹窗" onClick={onClose}><X size={19}/></button></div></div><div className="modal-window-body">{children}</div></dialog>;
}
