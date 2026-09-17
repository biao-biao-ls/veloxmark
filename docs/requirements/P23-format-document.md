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
- [ ] 去除行尾空白；恰好 2 个空格的硬换行保留，>2 规范为 2
- [ ] ATX 标题规范化：`#标题` → `# Title`（补空格）；`#` 后多空格压为
      1 个；标题后 `#` 闭合序列去除
- [ ] 标题/围栏代码块/表格前缺失空行时补 1 空行（文档首行除外）
- [ ] 连续 ≥2 空行压缩为 1 空行
- [ ] 无序列表标记统一为 `-`（fence 外）；同层缩进对齐子级（保留层级
      结构，仅符号统一）
- [ ] 有序列表：连续项重新编号 1..n（fence 外；嵌套各自编号）
- [ ] GFM 表格：全部经 `formatTable` 重排 `|` 对齐（保留对齐行语义与
      单元格内容原样）
- [ ] 围栏代码：开 fence 语言标记去首尾空白；**fence 内容与行尾空白
      一律不动**；缺失闭合 fence 的块跳过并计入警告
- [ ] 文件尾保证恰好 1 个换行
- [ ] 引用行 `>` 后规范化为单空格（`>文本` → `> 文本`）

### 行为
- [ ] 命令 `formatDocument`：Edit 菜单（Format Document），默认键
      `Shift+Alt+F`（与 VS Code 一致）
- [ ] 整次格式化为**单 transaction**：一次 Ctrl+Z 完整回退
- [ ] 光标/选区 best-effort 保持：按行号映射（行数变化时钳制到合法
      行）；滚动位置尽量保持
- [ ] 无可改动时命令静默（无 toast 刷屏）；可选状态栏显示 "已格式化
      N 处"（对接 P14）
- [ ] （可选）format-on-save：偏好 `formatOnSave: boolean`（默认
      **关**），开启后保存前先格式化；与 P12 自动保存共用同一入口
- [ ] 格式化警告（缺闭合 fence 等）汇总后一次性提示，不阻塞执行

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
