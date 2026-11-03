// 0x54F30..0x54F50 and original labels at 0xD6AAC (7 pointers).
export function itemCategory(meta,extra){
 const kind=(meta&0xe0)>>>5;
 const key=kind===5?(extra===9?5:6):kind;
 const labels=['茶器','美术品','财宝','武器','南蛮舶来品','日文书籍','汉文书籍'];
 return {key:kind>5?'unknown':String(key),label:kind>5?'未确认分类':labels[key]};
}
