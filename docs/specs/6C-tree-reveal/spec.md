# 6C 树展开定位与行质感（任务 6.5 + 6.6）

## What / Why

展开策略反转：**默认全折 + 激活文件祖先链自动展开并滚动 reveal 到视口**（对齐 Typora），消灭 `temp/veloxmark/veloxmark-2.png` 的深树全开瀑布；补行图标与 hover 层次，修 5D 记录点名的「文件树行距紧凑、缺 hover 层次感、整体偏平」（评估 P0-2 + P1 视觉项）。

## 背景与现状

- 默认展开规则与 Typora 相反：「子节点 ≤100 的目录预展开、>100 折叠」（`FileTree.tsx:39` `COLLAPSE_CHILDREN_OVER`、L139-140），深树首屏全开。
- **无** reveal：当前文件高亮（`filetree-active`，L273-274）不保证在视口内；祖先折叠时高亮行根本不可见；tab 切换不滚动定位。
- 展开态是组件本地 state（不持久化、不跟随激活文件）。
- 行渲染无图标：仅目录 chevron（L204-291）；Typora 有目录/文件图标（typora-2.png）。
- 虚拟滚动：可见行 >500 时窗口化（`ROW_HEIGHT=25`、overscan 10，L33-35）。

## 验收标准（AC）

1. 树初始/换根时**子目录默认折叠**（根层文件 + 一级子目录可见），不再有深树全开瀑布。
2. 激活文档的祖先链目录自动展开，文档行滚动 reveal 到视口（虚拟滚动下同样正确）。
3. tab 切换 / 换根 / 从编辑器跳转定位时 reveal 同步；用户手动展开的目录不因 reveal 被强制收回。
4. 目录/文件行有图标区分（目录 / md 文件），hover 有层次反馈（背景 + 图标态），深浅主题一致；不引入 emoji 字符当图标。
5. 既有交互不回归：点击打开、chevron/行点击折叠展开、拖拽移动、右键菜单、内联重命名、`filetree-active` 高亮。
6. 虚拟滚动与 reveal 兼容（flatten 重算后滚动到正确 offset）。

## 约束

- class 契约不破坏：`filetree` / `filetree-item` / `filetree-active` / `filetree-dir-label` / `filetree-renaming` / `filetree-drop-target`（改名即断探针）。
- `ROW_HEIGHT` / `VIRTUALIZE_AT` 常量语义不变（reveal 用同一坐标系）。
- 图标实现走 CSS/内联 SVG（`--space-*` / 现有图标机制同源），不新增图标字体依赖。
- 展开策略属**行为变更**：收敛记录 + 人工冒烟必做。
- i18n：新 key（若有 aria-label）en+zh 同加。
