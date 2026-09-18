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
- [ ] Edit 菜单 / 命令 `insertTable`（Insert Table…）：弹出行列选择
      对话框
- [ ] 对话框内容：
      - 网格式行列拾取器（hover 高亮，如最大 12 列 × 20 行，点击确认；
        也可直接输入行/列数字）
      - 对齐方式：全部列统一 左/中/右/无（写入 delimiter 行 `:---` 等）
      - 预览区：实时显示将插入的 Markdown 源码（含 header 行 + 空单元格）
- [ ] 确认后在光标处插入表格：前后补齐空行；首行为表头（单元格为空或
      `列1…列N` 可选前缀，对话框开关）；光标落在表头第一格
- [ ] 插入后表格立即以 TableWidget 渲染，可直接进入 P10 单元格编辑

### 选区转表格
- [ ] 命令 `convertToTable`（Convert Selection to Table…）：对选中文本
      按分隔符转换为 GFM 表格
- [ ] 分隔符选择：Tab / 逗号 / 竖线 / 多空格（对话框单选 + 预览）；
      自动嗅探给出默认项（优先 Tab，其次含逗号行占比）
- [ ] 首行作为表头；空行忽略；单元格内容含分隔符时转义策略：逗号/竖线
      模式下加引号不适用 GFM——**按原样保留**（可能裂列，文档注明），
      Tab 模式无此问题
- [ ] 无选区时命令禁用或提示（菜单项置灰）

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
