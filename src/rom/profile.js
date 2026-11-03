/** Evidence-backed layout shared by the nine locally checked MD Taikou files. */
export const PROFILE = Object.freeze({
 id:'md-taikou-initial-tables-v1', label:'MD 太阁 · 初始资料布局 v1',
 people:Object.freeze({base:0x7b35e,stride:60,count:713}),
 names:Object.freeze({base:0x85d20,stride:16,count:713}), // Legacy text anchor: actual family begins at +2.
 portraits:Object.freeze({base:0x85d30,stride:16,count:713}), // Actual per-character trailing selector word.
 items:Object.freeze({base:0x88f32,stride:14,count:300}),
 instances:Object.freeze({base:0x7a8b0,stride:4,count:80}),
 castles:Object.freeze({base:0x77952,stride:20,count:125}),
 signatures:Object.freeze([
  Object.freeze({offset:0x54ff2,hex:'102a000b2f00487900074d2a',meaning:'宝物价值以单字节 +11 读取'}),
  Object.freeze({offset:0x503e6,hex:'1033880c0280000000e07260',meaning:'武具类别以 +12 的高三位判断'}),
  Object.freeze({offset:0x17de2,hex:'48780140487900ff00404879',meaning:'初始物品实例表的复制过程'}),
 ])
});
export const STATS=['外交','内政','魅力','统率','武力','野心'];
export const SKILLS=['铁炮','骑马','筑城','辩才','调略','茶道','艺术','文化'];
export const GRADES=['D','C','B','A'];
export const RANKS=['浪人','足轻头','物头','目付','奉行','中老','家老','宿老','大名'];
export const hex=(n,width=6)=>'0x'+n.toString(16).toUpperCase().padStart(width,'0');

export const RELEASE = Object.freeze({"version": "1.40.02", "title": "TAIKOU PRO V1.40.02 DEBUG FIX", "size": 1409988, "signatures": [{"offset": 116456, "hex": "4ef900158320"}, {"offset": 116670, "hex": "4ef90015836e4e714e71"}, {"offset": 1368314, "hex": "4ef9001583ae4e714e71"}, {"offset": 1368420, "hex": "6700ff94"}, {"offset": 1368510, "hex": "6700ff3a"}, {"offset": 1368580, "hex": "6700fef4"}, {"offset": 1409824, "hex": "76030c0400a06600003a0c5300a0660000384a2b001c66000030303900ff0018024000026600001c0c39000300ff001e6406523900ff001e7000103900ff001e16004ef90001c7204ef90001c6f00c0400a0662a0c5300a066244a2b001c661e0c030001670c0c030002670c4ef90001c87a4ef90001c7cc4ef90001c7c8b44665f00c03000167ea4ef90001c7c84eb9000056304a8066f64eb9000056404ef90014e104"}]});
