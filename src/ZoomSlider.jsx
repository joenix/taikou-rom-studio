export const ZOOM_STOPS=[4,6,8,12,16];
export default function ZoomSlider({value,onChange,label='地图缩放'}){
 const index=Math.max(0,ZOOM_STOPS.indexOf(value));
 return <div className="zoom-control"><label className="sr-only" htmlFor={label}>{label}</label><input id={label} type="range" min="0" max="4" step="1" value={index} aria-label={label} aria-valuetext={`${ZOOM_STOPS[index]}倍`} onChange={e=>onChange(ZOOM_STOPS[Number(e.target.value)])}/><div className="zoom-stops">{ZOOM_STOPS.map(n=><button type="button" key={n} aria-label={`缩放至${n}倍`} aria-pressed={value===n} className={value===n?'active':''} onClick={()=>onChange(n)}>×{n}</button>)}</div></div>;
}
