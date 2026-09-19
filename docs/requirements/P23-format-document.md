# P23 文档格式化

优先级：P23 | 类别：UX/工程 | 预估规模：S–M

## 背景

协作与版本管理场景需要"脏"Markdown 能一键整形：手打文档常见
`#标题` 缺空格、列表符号混用 `*`/`+`、表格 `|` 错位、块间空行不齐。
P01 非目标明确排除了 format-on-save，P10 只做到单表 `formatTable`。
现在补独立的 Format Document 命令——纯函数实现，测试友好（P15）。

## 目标

保守、可预期、一次 undo 可回退的全文格式化：只动"形"不动"意"，
fence/行内代码内容零触碰。

## 功能需求

### 格式化规则（v1）
- [x] 去除行尾空白；恰好 2 个空格的硬换行保留，>2 规范为 2
- [x] ATX 标题规范化：`#标题` → `# Title`（补空格）；`#` 后多空格压为
      1 个；标题后 `#` 闭合序列去除
- [x] 标题/围栏代码块/表格前缺失空行时补 1 空行（文档首行除外）
- [x] 连续 ≥2 空行压缩为 1 空行
- [x] 无序列表标记统一为 `-`（fence 外）；同层缩进对齐子级（保留层级
      结构，仅符号统一）
- [x] 有序列表：连续项重新编号 1..n（fence 外；嵌套各自编号）
- [x] GFM 表格：全部经 `formatTable` 重排 `|` 对齐（保留对齐行语义与
      单元格内容原样）
- [x] 围栏代码：开 fence 语言标记去首尾空白；**fence 内容与行尾空白
      一律不动**；缺失闭合 fence 的块跳过并计入警告
- [x] 文件尾保证恰好 1 个换行
- [x] 引用行 `>` 后规范化为单空格（`>文本` → `> 文本`）

### 行为
- [x] 命令 `formatDocument`：Edit 菜单（Format Document），默认键
      `Shift+Alt+F`（与 VS Code 一致）
- [x] 整次格式化为**单 transaction**：一次 Ctrl+Z 完整回退
- [x] 光标/选区 best-effort 保持：按行号映射（行数变化时钳制到合法
      行）；滚动位置尽量保持
- [x] 无可改动时命令静默（无 toast 刷屏）；可选状态栏显示 "已格式化
      N 处"（对接 P14）
- [x] （可选）format-on-save：偏好 `formatOnSave: boolean`（默认
      **关**），开启后保存前先格式化；与 P12 自动保存共用同一入口
- [x] 格式化警告（缺闭合 fence 等）汇总后一次性提示，不阻塞执行

## 实现要点

- 纯函数 `editor/format.ts`：
  `formatMarkdown(text: string): { text: string; warnings: string[] }`
  - 内部按行扫描，维护 fence 状态机（``` / ~~~，含缩进 fence），fence
    内行原样输出
  - 表格检测：连续 `|` 行且下行为 delimiter 行 → 整块收集后
    `formatTable` 重写；表格块与 fence 状态互斥判断顺序：fence 优先
  - 列表重编号：按缩进层级分栈处理
  - 不做语法树依赖（纯文本规则可测性最强）；与 live preview 结果一致性
    由验收把关
- 命令接线：`commands.ts` 注册，run 内
  `view.dispatch({ changes: { from: 0, to: doc.length, insert: out },
  selection: remap(...) })` + `userEvent: 'format'`（history 归并为一步）。
- format-on-save：`preferences/store.ts` 增字段；
  `useFileOps.saveFile`/`saveFileAs` 在 `writeFile` 前按开关调用
  formatMarkdown 并 dispatch（注意 dirty 判定：格式化后内容变化仍算
  dirty 直至写出）。
- 单测（P15）：`formatMarkdown` 纳入 `npm run test:unit`，夹具含：fence
  内脏表格不被改、缺空行标题、混合列表符号、编号列表、硬换行保留。
- 性能：纯文本单次扫描，10k 行文档应在个位数 ms 内完成，不需增量。

## 验收标准

1. 构造脏文档（`#标题`、`* a`、`+ b`、表格歪斜、标题前无空行、行尾
   多余空白）执行命令：输出符合全部规则；Ctrl+Z 一步回到原文。
2. fence 内的歪斜表格与行尾空白在格式化后**原样保留**。
3. 有序列表 `3.` `7.` `1.` 连续项 → `1.` `2.` `3.`；嵌套子列表各自
   独立编号。
4. 硬换行（行尾恰好 2 空格）保留；3+ 空格压缩为 2。
5. 开启 format-on-save 后 Ctrl+S：磁盘内容已格式化；关闭开关后保存
   不再改写。
6. 缺闭合 fence 的文档：其余规则正常应用，警告提示列出跳过的块。

## 非目标

- Prettier 级全量规则（段落折行 80 列、引用风格统一等）
- Markdown 自动修复（断链修复、拼写）
- 格式化范围限定选区（首版全文；后续可加 Format Selection）

## 实施状态（已完成）

- 纯函数 `editor/format.ts` `formatMarkdown(text) → {text, warnings[], changed}`：
  fence 状态机（``` / ~~~，含缩进；fence 内零触碰；缺闭合跳过并 warning
  「unclosed code fence starting at line N」）；v1 规则全部实现——行尾空白
  （恰好 2 空格硬换行保留、>2 压为 2、其余去除）、ATX 规范化（补空格/压
  多空格/去闭合 `#` 序列）、标题/fence/表格前补空行（首行除外）、空行
  压缩、无序标记统一 `-`（thematic break 如 `* * *` 跳过）、有序重编号
  （按缩进分栈、嵌套各自编号）、表格经 `formatTable` 重排（保留对齐语义与
  单元格原文，`\|` 不裂列）、fence 语言标记 trim（开 fence 行
  ` ```  js  ` → ` ```js `，不强加空格——实施注明）、文尾恰好 1 换行、
  引用 `>` 后单空格。
- **有序列表与空行**：CommonMark 空行不拆列表（loose list），故重编号
  跨空行连续（1,2,3 空行后 4,5…）；嵌套层级各自从 1 起。夹具与 e2e
  按此口径断言。
- 命令 `formatDocument`：Edit 菜单 + `Shift+Alt+F`（bindGlobal + darwin
  accelerator）；`matchGlobalShortcut` 扩展支持 Alt 前缀 chord（原逻辑只认
  Ctrl 或裸 F 键）且用 `e.code` 兜底 macOS Option 键产生的变体字符；单
  transaction（`from:0` 全文替换 + `userEvent:'format'` 一步 undo + 行号
  映射钳制光标）；无改动静默；有改动 StatusBar toast「已格式化 N 处」，
  带警告时「已格式化 N 处（w 条警告）」（warnings 走 toast 而非弹窗，
  保持不阻塞——实施取舍）；e2e 经 `__veloxP23.format()` 可读 warnings 数组。
- format-on-save：偏好 `formatOnSave`（默认关，Preferences 自动保存区新增
  开关「保存时格式化」）；`useFileOps.saveFile/saveFileAs` 在 writeFile 前
  按开关格式化再取内容写出（格式化后的 dirty 状态由随后的写出清除）。
- 单测 `format.test.ts` 12 例覆盖需求全部规则 + fence 内脏表格/行尾空白
  不动 + 缺闭合 fence 警告；`npm run test:unit` 148/148。
- e2e `cdp-p23.mjs`（9240）13/13 ALL PASS：脏文档逐规则断言、Ctrl+Z 一步
  回原文、fence 内原样、有序重编号+嵌套、硬换行 2/压2、干净文档静默、
  Shift+Alt+F 快捷键、缺闭合 fence 其余规则正常+警告 toast、format-on-save
  开/关两种磁盘内容断言。
- 未做项：无（弹窗提示 warnings 按不阻塞原则改走状态栏，已注明）。
