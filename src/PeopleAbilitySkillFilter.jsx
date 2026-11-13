import {X} from 'lucide-react';
import {STATS,SKILLS,GRADES} from './rom/profile.js';

export default function PeopleAbilitySkillFilter({abilityRules,setAbilityRules,abilityMode,setAbilityMode,skillRules,setSkillRules,skillMode,setSkillMode,onChange}){
 const addAbility=()=>{const index=STATS.findIndex((_,i)=>!abilityRules.some(rule=>rule.index===i));if(index>=0){setAbilityRules(rows=>[...rows,{index,minimum:'70'}]);onChange();}};
 const addSkill=()=>{const index=SKILLS.findIndex((_,i)=>!skillRules.some(rule=>rule.index===i));if(index>=0){setSkillRules(rows=>[...rows,{index,grade:2}]);onChange();}};
 return <section className="people-filter-panel" aria-label="能力与技能筛选">
  <div className="people-filter-group">
   <div className="people-filter-heading"><strong>能力下限</strong><select aria-label="多项能力条件关系" value={abilityMode} onChange={e=>{setAbilityMode(e.target.value);onChange();}}><option value="all">全部符合</option><option value="any">任一符合</option></select><button type="button" className="button" disabled={abilityRules.length>=STATS.length} onClick={addAbility}>＋ 添加能力</button></div>
   {abilityRules.length?abilityRules.map(rule=><div className="people-filter-rule" key={rule.index}>
    <select aria-label="能力项目" value={rule.index} onChange={e=>{const index=Number(e.target.value);setAbilityRules(rows=>rows.map(row=>row.index===rule.index?{...row,index}:row));onChange();}}>{STATS.map((name,index)=><option value={index} key={name} disabled={abilityRules.some(row=>row.index===index&&row.index!==rule.index)}>{name}</option>)}</select>
    <label>≥ <input type="number" min="0" max="255" aria-label={`${STATS[rule.index]}最低值`} value={rule.minimum} onChange={e=>{setAbilityRules(rows=>rows.map(row=>row.index===rule.index?{...row,minimum:e.target.value}:row));onChange();}}/></label>
    <button type="button" className="icon-button" aria-label={`移除${STATS[rule.index]}能力筛选`} onClick={()=>{setAbilityRules(rows=>rows.filter(row=>row.index!==rule.index));onChange();}}><X size={15}/></button>
   </div>):<p className="caption">例如：统率 ≥ 80</p>}
  </div>
  <div className="people-filter-group">
   <div className="people-filter-heading"><strong>技能等级</strong><select aria-label="多项技能条件关系" value={skillMode} onChange={e=>{setSkillMode(e.target.value);onChange();}}><option value="any">任一符合</option><option value="all">全部符合</option></select><button type="button" className="button" disabled={skillRules.length>=SKILLS.length} onClick={addSkill}>＋ 添加技能</button></div>
   {skillRules.length?skillRules.map(rule=><div className="people-filter-rule" key={rule.index}>
    <select aria-label="技能项目" value={rule.index} onChange={e=>{const index=Number(e.target.value);setSkillRules(rows=>rows.map(row=>row.index===rule.index?{...row,index}:row));onChange();}}>{SKILLS.map((name,index)=><option value={index} key={name} disabled={skillRules.some(row=>row.index===index&&row.index!==rule.index)}>{name}</option>)}</select>
    <label>≥ <select aria-label={`${SKILLS[rule.index]}最低等级`} value={rule.grade} onChange={e=>{setSkillRules(rows=>rows.map(row=>row.index===rule.index?{...row,grade:Number(e.target.value)}:row));onChange();}}>{GRADES.map((grade,index)=><option value={index} key={grade}>{grade}</option>)}</select></label>
    <button type="button" className="icon-button" aria-label={`移除${SKILLS[rule.index]}技能筛选`} onClick={()=>{setSkillRules(rows=>rows.filter(row=>row.index!==rule.index));onChange();}}><X size={15}/></button>
   </div>):<p className="caption">例如：骑马 ≥ B；多项默认任一符合</p>}
  </div>
 </section>;
}
