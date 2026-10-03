# IT-03-FE-04 自测报告 — 图片编辑浮层（尺寸拖拽/对齐按钮写 .md 图片语法 + undo + 回执）

- 任务：`process-docs/ui-ux-redesign/tasks/IT-03/FE-04.md`
- 工作目录：`projects/.worktrees/typora/ui-ux-redesign/frontend/src/renderer`
- 日期：2026-09-29
- 验收：AC-OP-13 / AC-ERR-08 / UI-IXD-10 / AC-OP-18（图片段）
- 实现图：[IT-03-FE-04-impl.png](./IT-03-FE-04-impl.png)（S1 hover 态：浮层对齐三键 + 宽度下拉 + ✓ 完成 + 右下角柄）
- 浏览器验收：CDP 驱动 [IT-03-FE-04-cdp-driver.mjs](./IT-03-FE-04-cdp-driver.mjs)，结果 [IT-03-FE-04-cdp-data.json](./IT-03-FE-04-cdp-data.json) — **30/30 checks passed**

## 0. 语法口径（`ren-image:write-md` 写回单源）

尺寸/对齐一律落 `.md` 图片语法（非显示态旁路），外科式改写只动被改槽位：

| 操作 | 源码形态 | 例 |
|---|---|---|
| 尺寸 | Typora/pandoc `=WxH` 像素槽（P05 既有口径） | `![cover](logo.png =360x240)` → `=480x480` |
| 对齐 | `{align=left\|center\|right}` brace 后缀（与既有 `{flip=}` 同口径） | `![cover](logo.png =360x240){align=center}` |
| 翻转（P05 复用面） | `{flip=h\|v\|hv}`（既有，本次仅统一走写回闸门） | `![a](b.png){flip=h}` |

- 写回单入口 `editor/imageEdit.applyImageEdit`：只读前置闸（AC-ERR-08）→ 语法树定位节点 → 单次 dispatch（undo 边界 = 单次编辑）→ 回执 toast。
- 宽度下拉「宽度 N%」为呈现层派生（px / naturalWidth），写回仍落 `=WxH` px。

## 1. S1 hover 浮层结构 + 正文位移 0px（UI-IXD-10 判据 2）

| 判据 | 期望 | 实测 | 结果 |
|---|---|---|---|
| 浮层随 hover 浮现 | hover 图片 ≥150ms 后 `.cm-md-float` 出现 | 172ms 出现 | ✓ |
| 对齐三键齐备 | ◧ ▣ ◨ 三键 + title「左对齐/居中/右对齐」 | 3 键 | ✓ |
| 宽度下拉齐备 | 「宽度 N%」+ ▾ | label「宽度」+ selected「35%」（=360/1024） | ✓ |
| ✓ 完成按钮齐备 | `image-edit-done` | 「✓ 完成」 | ✓ |
| 尺寸角柄齐备 | 图片右下角 14×14 小方块，title「拖拽调整尺寸」 | present，14×14，title 正确 | ✓ |
| 正文位移 0px | 浮层浮现前后全部 `.cm-line` boundingClientRect 零容差 | 7 行，maxShift=0 | ✓ |

## 2. S2 尺寸拖拽 → .md 落 `=WxH` + 回执 + 一步 undo（AC-OP-13）

| 判据 | 期望 | 实测 | 结果 |
|---|---|---|---|
| 拖拽中预览连续跟随 | 角柄拖动时 img style 实时变化 | 360×240 → 480×480（dominant-axis 保纵横比） | ✓ |
| 松开落 .md | `=WxH` 槽位改变 | `=360x240` → `=480x480` | ✓ |
| .md 与渲染一致 | 源码尺寸 = 渲染尺寸 | `=480x480` ↔ 480×480 | ✓ |
| 回执 toast | 含「（Ctrl+Z 可撤销）」 | 「已调整图片尺寸（Ctrl+Z 可撤销）」 | ✓ |
| 一次 Ctrl+Z 还原 | 单事务边界 | 一次 Ctrl+Z 后文档逐字节回编辑前 | ✓ |
| 无残留 | 退出后无浮层/角柄残留 | 见 S5 | ✓ |

**.md 前后对照（S2）**：

```
- ![cover](logo-master.png =360x240)
+ ![cover](logo-master.png =480x480)
```

## 3. S3 对齐按钮 → .md 落 `{align=…}` + 保尺寸 + 一步 undo（AC-OP-13）

| 判据 | 期望 | 实测 | 结果 |
|---|---|---|---|
| 对齐键激活态 | 点击键 `.is-on` + `aria-pressed` | `image-align-center` | ✓ |
| .md 落对齐语法 | 追加 `{align=center}` | `…=360x240){align=center}` | ✓ |
| 对齐改写保尺寸 | `=WxH` 字节不变 | 前后均 ` =360x240` | ✓ |
| 渲染尺寸不变 | img 尺寸不变 | 480×480 → 480×480 | ✓ |
| 回执 toast | 同格式 | 「已设置图片对齐（Ctrl+Z 可撤销）」 | ✓ |
| 一次 Ctrl+Z 还原 | 单事务边界 | 一次 Ctrl+Z 后文档逐字节回编辑前 | ✓ |

**.md 前后对照（S3）**：

```
- ![cover](logo-master.png =360x240)
+ ![cover](logo-master.png =360x240){align=center}
```

补充语义：无对齐属性的图按 `left` 呈现（左键默认 `.is-on`）；再点当前激活键是 no-op（不改文档、不回执），避免强写 `{align=left}` 噪声。

## 4. S4 只读拦截（AC-ERR-08）

fixture：`fe04-readonly-selftest.md` chmod 0o444 后 `loadDoc` 同路径。

| 判据 | 期望 | 实测 | 结果 |
|---|---|---|---|
| 只读探针 | `file:isWritable` → false | `false`（`fs.access W_OK` 真源） | ✓ |
| 对齐点击被拦截 | 文档逐字节不变 | before === after | ✓ |
| toast 文案精确 | 「文件为只读，无法修改，可另存后编辑」 | 逐字命中 | ✓ |
| 拖拽路径同拦 | 文档逐字节不变 | before === after | ✓ |
| 拖拽 toast 同文 | 同上冻结文案 | 逐字命中 | ✓ |
| 解除只读后可落盘 | 同一操作写入 | chmod 0o666 后对齐点击落 `{align=right}` | ✓ |

- 写前拦截：`assertWritable()` 失败即放弃 dispatch——不写入、不半提交、无 undo 噪声。
- 拦截期间 `.md` 与渲染完全不动（byte-identical 双路径判据：对齐 + 拖拽）。
- 「可另存后编辑」闭环：只读属性解除（等价另存为副本为可写文件）后同一操作立即落盘。

## 5. S5 退出路径无残留 + 位移 0px（UI-IXD-10）

| 路径 | 残留控件 | 正文位移 | 结果 |
|---|---|---|---|
| 「✓ 完成」 | floats=0, handles=0 | 7 行 maxShift=0 | ✓ |
| 点浮层外部 | floats=0, handles=0 | 7 行 maxShift=0 | ✓ |

- 角柄经 `createPortal` 挂在图片 wrap 内、由浮层组件持有——浮层卸载即带走，hover-only 渲染零残留。
- 显隐全走 FE-03 `hoverDiscipline` bus（`hideNow`/`pin`/`unpin`），无自写 setTimeout、无第二个 RenderFloatHost。

## 6. AC-OP-18 导出同口径（图片段）

编辑器外的 HTML/PDF/复制富文本三通道共用 `export/renderDoc`，Image 分支输出与编辑器同尺寸/同对齐：

| 判据 | 实测 | 结果 |
|---|---|---|
| `=WxH` → `width`/`height` 属性 | `width="360" height="240"` | ✓ |
| `{align=center}` → `display:block;margin-left:auto;margin-right:auto` | 命中 | ✓ |
| `{align=right}` / `{align=left}` 对应 margin 形态 | 命中 | ✓ |
| 尺寸+flip+align 同标签共存 | 命中 | ✓ |
| 无属性图无 style/size 噪声 | 命中 | ✓ |

单测钉死：`export/renderDoc/inline.test.ts` 5 用例（imageMode:relative 纯函数路径，不触 window.api）。

## 7. AC 验收证据映射

### AC-OP-13（拖拽/对齐写 .md + 回执 + 一步 undo + 无残留）
§2 + §3 全表（.md 前后对照、冻结回执文案、单事务 undo、S5 无残留）。

### AC-ERR-08（只读拦截）
§4 全表（W_OK 真源探针、双路径 byte-identical、冻结 toast 逐字、解除只读后落盘）。

### UI-IXD-10（hover/click 浮层 + 角柄 + 对齐键 + 干净退出 + 位移 0px）
§1 结构表 + 位移 0px（浮现前后）+ §5 两条退出路径（残留 0 + 位移 0px）。

### AC-OP-18（导出同尺寸/对齐）
§6 + `inline.test.ts` 5 用例。

## 8. 质量门禁

| 门禁 | 命令 | 结果 |
|---|---|---|
| 类型检查 | `npm run typecheck`（tsconfig.web + tsconfig.node） | **0 Error** ✓ |
| 单测 | `npm run test:unit` | **606 passed** ✓（含本任务新增 `markdown-image-ext.test.ts` 6 + `inline.test.ts` 5） |
| 构建 | `npm run build` | 成功 ✓ |
| 浏览器验收 | `IT-03-FE-04-cdp-driver.mjs`（Electron out/ 产物 + CDP 9444） | **30/30 checks passed** ✓ |
| e2e 缝 | `window.__velox*` 系列、命令 id 未改动 | 未破坏 ✓ |

## 9. 验证环境注记（CDP 驱动三坑，供后续任务复用）

1. **标题折叠会藏图**：`headingFolds` 按路径持久在 session，`Page.reload` 后仍折叠——折叠的 H1 把图片行整段藏掉（无 widget、无角柄）。驱动在每次 `loadDoc` 后 `__veloxP18.restoreKeys([])` 展开并断言 `getFoldedKeys().length===0`。
2. **「中性点」不能点标题/折叠占位/折叠槽**：点击这些元素会切换折叠，正文布局突变。中性点扫描排除 `.cm-md-heading`/`.cm-md-fold-placeholder`/`.cm-gutters`/`.cm-md-fold-gutter`。
3. **session 恢复可能在 loadDoc 之后又切回上个 tab**：`filePathRef` 被翻回只读路径时，只读闸会误拦所有写回（表现为 S2/S3 冒「文件为只读」）。驱动 `loadDocExpanded` settle 循环断言 `getFilePath()===目标路径`。

## 10. 文件清单

**新增**
- `src/renderer/src/components/ImageEditFloat.tsx` — 浮层组件（对齐三键/宽度下拉/✓ 完成 + 角柄 portal），模块顶层 `registerHoverContent` 注册
- `src/renderer/src/editor/imageEdit.ts` — 写回单源（外科式改写 + 只读闸 + 单事务 + 回执）
- `src/renderer/src/editor/markdown-image-ext.test.ts` — Lezer 声明口径 6 用例
- `src/renderer/src/export/renderDoc/inline.test.ts` — 导出图片口径 5 用例
- `process-docs/ui-ux-redesign/reports/IT-03-FE-04/*` — 本报告 + CDP 驱动/数据 + 实现图

**修改**
- `src/renderer/src/editor/image-widget.ts` — 写回统一走 `applyImageEdit`；`applyImageAlignDom` 导出供浮层活体同步
- `src/renderer/src/editor/markdown-image-ext.ts` — `IMAGE_ATTR_RE` 声明 `{align=}`（与 `{flip=}` 任序多尾缀）
- `src/renderer/src/editor/readOnlyGuard.ts` — 探针 fail-open（IPC 故障不误杀编辑）
- `src/renderer/src/App.tsx` — 1 行 `import './components/ImageEditFloat'` 副作用注册
- `src/renderer/src/styles/{tokens,render-zone,markdown}.css` — 角柄/浮层控件 token 与对齐放置
- `src/renderer/src/export/renderDoc/inline.ts` — 导出对齐 inline style（AC-OP-18）
- `src/renderer/src/i18n/{zh,en}.ts` — `render.image.resizeTitle` 等文案 key
