# 4.2 按钮皮肤归并（= 1.7）

## What / Why

6 套 `<button>` 皮肤散布 5 个分区文件，皮肤声明（颜色/边框/hover）重复维护。抽出共享 primitives（`.btn`/`.btn-primary`/`.btn-danger`）单源化**皮肤**，几何（padding/font-size/min-width）留本地——目标是去重而非重设计，视觉像素级不变。

## 背景与现状

- `.dialog-btn` 族（overlays.css L65–96，`-primary` + `.theme-dark` 暗色特例注释 + `-primary:hover`）与 `.cm-search .cm-button`（editor-modes.css L66–85，+`:active`）**皮肤逐字平行**（color/bg/border/radius/cursor/hover-bg 六声明相同；几何不同：5px 14px/13px vs 4px 10px/12px + font-family/line-height）——真正可并的就是这两族。
- `.dialog-btn-danger`（forms.css L136–139）错挂在表单分区，同族归位。
- **非平行控制（不并入 btn 族）**：`.sidebar-mode-seg button`（分段控件，current 态语义）、`.sb-stat-btn`（ghost + `--focus-ring`/22px 命中区契约 UX-P14）、`.mermaid-preview-bar button`（chip + `.is-on`/focus-visible 契约）、`.tab-context-menu button`（菜单项）——强行归并将造成视觉回归与契约损伤，spec-kit 纪律不猜、按控制族诚实划界。
- 消费面：Dialog/ExportDialog/Preferences 三组件的 `dialog-btn*` class（**零改动**，别名兼容）；`data-op` id 不涉。

## 验收标准（AC）

- **AC1**：新 `styles/buttons.css` 成为 `.btn`/`.btn-primary`/`.btn-danger` primitives 唯一落点；`.dialog-btn` 族 + `.cm-search .cm-button` 皮肤声明并入同规则组（comma-selector），几何声明留各自名下；`.dialog-btn-danger` 迁入同文件归族。原三处声明块删除。
- **AC2**：所有声明**值逐字迁移**（含 `.theme-dark .dialog-btn-primary` 特例及其注释、cm-button `:active`、primary:hover 的 `filter`）——computed style 等价；**零 TSX 改动**（DOM class 兼容，探针/用户脚本零风险）。
- **AC3**：`styles.css` barrel 注入 `@import './styles/buttons.css';`（位置在 forms.css 后、editor-modes.css 前，保持 `:active` 压过 `:hover` 的原有级联次序）。
- **AC4**：非并 4 控制族在 buttons.css 头注释点名划界；constitution 按钮条款更新为「新按钮用 `.btn` 族，`.dialog-btn` 系为兼容别名」。
- **AC5**：`npm run typecheck && npm run test:unit` 全绿（palette↔CSS 对齐测试守护改色——本次零改色不触）。

## 约束

- **视觉不变**：像素级等价（同值迁移）；暗色特例注释（1B/1.6 记录的 why）必须随迁不丢。
- CSS 纪律：不新增裸 px 新值（沿用既有值）；不新增选择器级 `.theme-dark` 补丁（特例是既有迁移非新增）。
- e2e 缝：DOM class 名零变化（`dialog-btn*`/`cm-button` 保留）。

## 不做

- 不重设计按钮尺寸/圆角/主题 token；不统一 4 个非平行控制族；不动 `.dialog-buttons`/`.dialog-actions` 布局容器（留 overlays.css）。
- 不改 TSX className；不做 `.btn` 类的组件层推广（后续新代码自然采用）。
