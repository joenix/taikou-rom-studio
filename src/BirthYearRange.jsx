export default function BirthYearRange({people,value,onChange}){
 const years=people.map(p=>p.birthYear).filter(Number.isFinite);
 if(!years.length)return <span className="caption">此 ROM 无生年配置</span>;
 const min=Math.min(...years),max=Math.max(...years),[low,high]=value||[min,max];
 return <div className="birth-range"><span>出生年 <strong>{low}–{high}</strong></span><div className="birth-range-track"><input type="range" aria-label="出生年下限" style={{zIndex:low===max?3:1}} disabled={min===max} min={min} max={max} step="1" value={low} onChange={e=>onChange([Math.min(Number(e.target.value),high),high])}/><input type="range" aria-label="出生年上限" style={{zIndex:2}} disabled={min===max} min={min} max={max} step="1" value={high} onChange={e=>onChange([low,Math.max(Number(e.target.value),low)])}/></div></div>;
}
