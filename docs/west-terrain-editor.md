# v1.40.23 西端地图人工编辑

语义入口：world.expansion.west_honshu.layout。布局位于 src/rom/layouts/west-v14023.json；对应原始ROM SHA256 ac7da4db41f3d31abad2d51b4758df1e06cf8b3ee369194e02d757f83c423a59。

west-layout 验证585分区目录、代码与94处挂钩。六个可变寻路操作数通过逐项改变汇编常量比较机器码得到，不是猜测。west-map 解析负坐标并保护原地图与完整城町占位。west-navigation 移植 rebuild/tools/map_component_graph.py，测试对原图结果逐字节比较。陆路允许>=44，水路额外允许<=23，与现行ROM一致。

导出预留0x60000字节可复用寻路槽，含4KiB目录及TKWNAV01尾标。只改变六个已核验操作数，原人物生年尾标与后续宝物图标扩展保持可读。ROM小于2MiB，不增加运行时RAM。连通分量容量1230、队列容量576仍受检查，超限拒绝导出。

49项测试通过、生产构建通过；浏览器检查拖绘、撤销重做、下载、框选填充、刷新恢复、手机只读与无横向页面溢出。实际导出ROM在Genesis Plus GX完成5项定点行走：新旧区往返、登船、靠岸、山口位置；目标、图像上传和异常入口检查通过。使用存档副本并在首步注入目标，不等于完整游戏或冷启动回归。机器证据 docs/evidence/west-editor-export.json。

边界：不新增分区/城町，不移动地点，不编辑町内地图。单格编辑仍需人工判断拼接，容量检查不保证所有地点可达。

手工导出ROM不会自动同步回 rebuild。2026-11-08用户回传「拼接修正2」的56格已提取到 rebuild/assets/maps/west-honshu/manual-overrides.json，生成器末尾应用并检查冲突，sectors.json及重编译585分区均匹配用户ROM。后续新的回传仍需提取并合并，不能直接重生成覆盖。原始ROM、发布版本与用户存档未修改。
