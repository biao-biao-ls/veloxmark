# P22 表格插入辅助

优先级：P22 | 类别：UX/功能 | 预估规模：S

## 背景

P10 已交付单元格级编辑（`editor/table/` 模块：`parse.ts`/`ops.ts`/
`widget.ts`），但**从零创建表格**仍靠手打 `| --- |`：新用户不记得
delimiter 语法，从 Excel/网页复制的数据要先手动转换。P10 验收里覆盖了
表内 TSV 粘贴，"光标处插入新表"与"选区转表格"是同一工作流的入口端。

## 目标

表格创建零门槛：行列选择器一键插入规范对齐的 GFM 表格；已有 TSV/分隔
文本一键转表格。

## 功能需求

### 插入表格对话框
- [x] Edit 菜单 / 命令 `insertTable`（Insert Table…）：弹出行列选择
      对话框
- [x] 对话框内容：
      - 网格式行列拾取器（hover 高亮，如最大 12 列 × 20 行，点击确认；
        也可直接输入行/列数字）
      - 对齐方式：全部列统一 左/中/右/无（写入 delimiter 行 `:---` 等）
      - 预览区：实时显示将插入的 Markdown 源码（含 header 行 + 空单元格）
- [x] 确认后在光标处插入表格：前后补齐空行；首行为表头（单元格为空或
      `列1…列N` 可选前缀，对话框开关）；光标落在表头第一格
- [x] 插入后表格立即以 TableWidget 渲染，可直接进入 P10 单元格编辑

### 选区转表格
- [x] 命令 `convertToTable`（Convert Selection to Table…）：对选中文本
      按分隔符转换为 GFM 表格
- [x] 分隔符选择：Tab / 逗号 / 竖线 / 多空格（对话框单选 + 预览）；
      自动嗅探给出默认项（优先 Tab，其次含逗号行占比）
- [x] 首行作为表头；空行忽略；单元格内容含分隔符时转义策略：逗号/竖线
      模式下加引号不适用 GFM——**按原样保留**（可能裂列，文档注明），
      Tab 模式无此问题
- [x] 无选区时命令禁用或提示（菜单项置灰）

## 实现要点

- 对话框：P02 `dialog` 体系只有 alert/confirm/prompt（
  `components/Dialog.tsx`）；本需求引入自绘表单对话框，模式对齐
  `components/ExportDialog.tsx`（React 组件 + App 挂载 + 显式 open/close）。
  新组件 `components/TableInsertDialog.tsx`；两种模式（insert/convert）
  同一对话框不同 tab 或分两个组件，实现时择简。
- 生成逻辑纯函数（进 P15 单测）：`buildTableMarkdown(rows, cols,
  align, headerPrefix) → string`，内部复用 `editor/table/parse.ts` 的
  `formatTable(aligns, rows)`；TSV/CSV 拆分复用 `editor/table/ops.ts`
  的 `parseTsv`（按需扩展逗号/多空格分隔的 `parseDelimited`）。
- 插入事务：`view.dispatch({ changes: { from, insert }, selection: 表头首格
  偏移 })`；光标在 fence 内/表格源码内时的策略：仍执行插入（用户意图
  明确），但表格源码内插入会破坏表——插入前用 syntaxTree 判断，位于
  Table/FencedCode 内时插入到该块之后并提示。
- 命令注册：`commands.ts` 注册表 + MENU_LAYOUT Edit 组；无默认快捷键
  （避免与系统冲突）；macOS 原生菜单 `buildDarwinMenu` 同步行。
- 无 baseDir/无文档限制：欢迎页也可插入（纯编辑器行为）。
- 验证：CDP 场景——打开命令 → 键盘选 3×2 → 确认 → 断言源码出现
  3 行 `|` 与 delimiter 行。

## 验收标准

1. Insert Table… 选 2 行 3 列居中对齐：光标处源码为 header + `:---:` ×3
   + 一行空单元格，`|` 对齐合法，渲染为表格。
2. 选中从 Excel 复制的 Tab 分隔三行文本 → Convert（自动嗅探为 Tab）→
   得到 3 列表格，表头正确。
3. 插入的表格首格可直接输入（P10 编辑立即可用）。
4. 光标位于代码块内执行插入：表格插入到代码块之后，代码块内容不受
   影响。
5. 对话框键盘可完成全流程（方向键选行列、Enter 确认、Esc 取消），
   跟随明暗主题。

## 非目标

- 合并单元格（Markdown 不支持）、公式
- CSV 文件导入向导、Excel 文件读取
- 表格样式主题（斑马纹等渲染增强——如做属渲染器样式需求）

## 实施状态（已完成）

- 命令：`insertTable`（Edit + Insert 菜单组）、`convertToTable`（Edit 菜单组，
  无默认快捷键）；darwin 原生菜单同步（Edit 组两项 + Insert 组 insertTable）。
  `convertToTable` 经新增的 `Command.isDisabled`（`buildMenus` → MenuItem.disabled）
  在无选区时置灰；原生菜单与 run() 路径兜底 toast「请先选中分隔文本」。
- 对话框：`components/TableInsertDialog.tsx` 受控双模式（insert/convert），
  网格式 20×12 行列拾取器（hover 高亮 + 点击即确认）+ 数字输入 + 对齐单选 +
  表头前缀开关 + 实时 `<pre>` 预览；convert 模式显示分隔符单选（Tab/逗号/竖线/
  多空格）与嗅探结果提示。键盘：方向键移动 hover（insert 模式同步行列数）、
  Enter 确认、Esc 取消；方向键事件经对话框内部乐观镜像（formRef）保证连按
  不丢步。样式用主题变量，明暗主题均可（e2e 断言 theme-dark 下渲染正常）。
- 纯函数：`editor/table/insert.ts` 的 `buildTableMarkdown`（内部 formatTable，
  表头 `列1…列N` 或空、delimiter 取对齐写法）与 `convertSelectionToTable`
  （首行表头、参差行补齐、**单元格原样保留不做转义**——GFM 无 CSV 引号语义，
  逗号/竖线模式含分隔符会裂列，已在本文件「实现要点」注明）；`ops.ts` 扩展
  `parseDelimited`（tab 复用 P10 quote-aware parseTsv；comma 简单 split+trim；
  pipe 去首尾 `|` 后 split；spaces 按 2+ 空格/Tab split）+ `sniffDelimiter`
  （任意 Tab→Tab；≥50% 行含逗号且逗号≥竖线→逗号；≥50% 行含竖线→竖线；
  多空格→spaces；兜底 逗号优先）。vitest 单测 `insert.test.ts` 12 例。
- 插入事务：`insertTableAtCursor` 用 syntaxTree 从光标向上找 Table/FencedCode
  父节点——命中则插到该块行尾之后并在 App 层 toast「已插入到代码块/表格
  之后」（验收④）；否则光标处插入，前后补齐空行；selection 落在插入源码
  `| ` 之后的表头首格（e2e 断言偏移 +2）。convert 命中 Table/FencedCode
  时拒绝并 toast「代码块/表格内无法转换」，源码不动。
- 渲染衔接：插入后 TableWidget 立即渲染（e2e 光标停在块外断言
  `.cm-md-table-wrap`）；首格 mousedown 进入 P10 编辑
  （`.cm-md-table-cell-editing`，e2e 断言）。
- 门禁：typecheck 干净、vitest 136/136（含 P22 12 例）、smoke 5/5、
  `cdp-p22.mjs`（9239）24/24 ALL PASS——覆盖验收①–⑤ + 无选区 toast +
  块内 convert 拒绝 + 明暗主题。
- 未做项：无（CSV 引号/转义按需求文档明确为非目标/文档注明项处理）。
