# 第一阶段证据与边界

来源：本机 `Downloads/Taiko_Editor_v2.5.html`、`Workspace/@AI/Codex/output/taiko-editor-review/评估与分阶段方案.md`，以及现有 libraries 中九个太阁文件的只读交叉核验。

| 内容 | 地址 / 结构 | 本阶段处理 |
|---|---|---|
| 武将表 | 0x7B35E，713 × 60 | 逐条编号、身份、居城、等级校验 |
| 姓名表 | 0x85D20，713 × 16，姓 +2/6，名 +8/8 | Shift-JIS 严格解码，保留名称前导字节 |
| 六维 | 武将 +0x27…+0x2C | 单字节，原样读出，不截到 100 |
| 技能 | 武将 +0x2D…+0x2E，八组 2 位 | 七项写入，保留文化低两位 |
| 相性 | 武将 +0x3B 低四位 | 只改低四位；不当作人物之间的相性差值 |
| 宝物 | 0x88F32，300 × 14 | 名称 +0/10，保留 +10，价值 +11 单字节 |
| 初始实例 | 0x7A8B0，80 × 4 | 第二字保留原码，不直接当人物 ID |
| 城池 | 0x77952，125 × 20 | 只开放名称 +0/9；邻接候选只读 |

`0x54FF2` 的 `MOVE.B (+11,A2)`、`0x503E6` 的类别掩码以及 `0x17DE2` 的实例复制入口，在九个文件中有相同的核验字节，作为当前布局识别的一部分。它们不代表整个游戏程序的行为都已验证。

未知类别只显示原码，只有 0x60 标注已核实的武具类别。初始势力从武将 +0x1A 汇总，不据此推断城池所有权。

编辑后进行字节差异检查、重载和单元测试；尚未对每个可编辑字段完成游戏运行时验收。首版不开放等级/经验、身份/出仕、头像或地图写入。

## TKROMD01 目录协议

新构建可在 ROM 中附带 `TKROMD01` 资源目录，由资料工坊按 `profile_id` 和资源 schema 识别布局，不以发行标题作为唯一版本线索。私有 v1.42 势力情报试玩 ROM 声明 `md-taikou-initial-tables-v1`，并提供 FEX1 payload 与 `japan-v14033` 地图布局标识。资料工坊识别到 1331 个地图分区、159 座城和 29 个町；Vite 构建通过，未运行测试套件或模拟器。标记描述资源，不代表新势力已经可玩。协议见 [ROM 目录标记](rom-directory.md)。

## v1.42 FEX1 扩展势力适配

ROM profile 由标题与 `0x14EB42` 新游戏桥接定位 FEX 初始数据指针；当前识别 18 家扩展势力、36 个扩展城池，及双方关系方向。payload 结构/访问边界见 [v1.42 FEX1 势力数据说明](faction-expansion-v142.md)。编辑器仅写入 FEX ROM 默认数据中的首领候补 ID 与本城 ID；普通势力只读，扩展城池字段只读。此扩展仍未被游戏势力/城池运行逻辑消费，故编辑器资料不表示新势力已能在游戏中登场。

### v1.42.23 directory / road-flow adapter

2026-11-12: node --test tests/road-flow-directory.test.js:4/4 PASS. npm run build:PASS. Confirmed159 castles,29 towns,713 people; supported616×368/1331-sector world; overview painting/export/reload with full road resource unchanged; malformed hooks/ranges rejected; precompiled terrain writes and legacy regeneration rejected. Tests use the actual released v1.42.23 ROM when locally present. No browser-visual or deployment claim in this check.
