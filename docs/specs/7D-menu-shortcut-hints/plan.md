# 7D 实施方案

## 技术决策与理由

- **keymap.ts 抽 `STRUCT_KEYS` 表**（`ReadonlyArray<{ key: string; cmd: StructCmd }>`）：`structKeyBindings` 改为 `.map()` 装配（行为不变重构）——key 字面量单一真源（7B 文件头契约「⑨ shortcut hints read this source」的兑现方式：读表而非抄字面量）。
- **`cmKeyToDisplay(key)` 纯函数**（keymap.ts 内）：CM key 语法（`Ctrl-Enter`/`Alt-ArrowUp`）→ `fmtShortcut` 输入格式（`Ctrl+Enter`/`Alt+↑`）。分段 split('-') 过 glyph 表（`ArrowUp/Down/Left/Right`→`↑↓←→`，修饰段原样）join '+'；`Enter` 保留词形（对照 `table-btn-4.png` 显示 `Ctrl+Enter` 而非 `⏎`）。留 keymap.ts 内因其零项目 import 纪律（glyph 表是纯数据）。
- **opsTable.ts 填字段**：`structShortcut(cmd)` 局部 helper——`STRUCT_KEYS` 查 cmd → `cmKeyToDisplay` → `fmtShortcut(s, isMac)`；`isMac = window.api.platform === 'darwin'`（组件层既有惯例）在 `tableDeltaItems` 打开菜单时取（非模块级，DOM-less import 安全）。填 5 项：`insertRowBelow`/`moveRowUp`/`moveRowDown`/`moveColLeft`/`moveColRight`（menu item id 与 `StructCmd` 同名，映射零翻译）。
- **渲染面零改动**：`.velox-ctx-shortcut` 已渲染 `item.shortcut ?? ''`（P27 DOM 契约），label `flex:1 1 auto` + shortcut `flex:0 0 auto` 已满足「无提示不占位」（AC2）；⋮ 工具栏菜单（7C）同 surface 自动获得提示。
- **测试**：`keymap.test.ts` 新建——`cmKeyToDisplay` 纯函数（5 真实 key + 多修饰段）+ `STRUCT_KEYS` → display 全表对照（防表与 glyph 漂移）。无 DOM/无 widget。
- **e2e**：只填 `CtxMenuItem.shortcut` 既有字段；`data-op`/DOM 契约/命令 id 零触碰。

## 文件切法

| 源 | 改动 |
|---|---|
| `editor/table/keymap.ts` | 抽 `STRUCT_KEYS`（字面量 ONCE）+ `structKeyBindings` map 装配 + `cmKeyToDisplay` 纯函数 |
| `editor/table/keymap.test.ts` | **新建**：glyph 转换 + STRUCT_KEYS 显示对照 |
| `editor/contextMenu/opsTable.ts` | 5 个结构项填 `shortcut`（`structShortcut` helper） |

无 CSS/i18n/widget/命令面改动。

## 状态/契约归属

无新状态。`CtxMenuItem.shortcut` 字段语义明确为**显示就绪字符串**（与 `commands/menuLayout.ts` 既有惯例一致：build 时已 fmtShortcut）。

## import 改动面

`opsTable` → `../table/keymap`（STRUCT_KEYS/StructCmd/cmKeyToDisplay）、`../../commands/shortcutDisplay`（fmtShortcut，零依赖叶子模块）。keymap 不新增 import（纯数据/纯函数）。**环检查点**：keymap 零项目 import 纪律保持；shortcutDisplay 无 import——madge 守护。

## 任务拆分

1. keymap.ts 抽表 + `cmKeyToDisplay` + 单测 [先行]
2. opsTable.ts 填 5 项 [依赖 1]

## 验证方案

- `npm run typecheck && npm run test:unit`（新单测全绿；i18n 无改动免对齐）
- `npx madge --circular --extensions ts,tsx src/renderer/src` 0 cycles
- e2e 缝：diff 零既有字面量改动
- 人工冒烟（对照 `table-btn-4.png`）：
  1. 表格单元格右键：下方插入行右列 `Ctrl+Enter`；上/下移该行 `Alt+↑/↓`；左/右移该列 `Alt+←/→`
  2. 其余项右列空白、不占位（label 左对齐一致性）
  3. 7C ⋮ 工具栏菜单同款提示
  4. mac 平台显示 ⌘/⌥ 风格（`window.api.platform` mock 或实机）
  5. 提示与实际按键行为一致（7B 绑定回归点）

## 实现细化（2026-09-24 implement 时决策）

- `STRUCT_KEYS` 抽表后 `structKeyBindings` = `.map(({key, cmd}) => …)`（行为不变）；`KEY_GLYPHS` 仅 4 箭头，`Enter`/`Tab` 等词形原样（对照基准图 `Ctrl+Enter`）。
- `structShortcut` 放 `tableDeltaItems` 内（`isMac` 打开菜单时取，DOM-less import 安全）；menu item id 与 `StructCmd` 同名直填。
- 5 项提示唯一填充面；其余项零改动（undefined → 空 span 零占位，CSS 免动）。

## 收敛记录（2026-09-24）

- `npm run typecheck` ✓（双 tsconfig）
- `npm run test:unit` ✓（33 files / 325 tests；keymap.test.ts 3 例）
- `npx madge --circular --extensions ts,tsx src/renderer/src` ✓ 0 cycles（227 files）
- e2e 缝核对 ✓：diff 零既有字面量改动（含 `velox-ctx` DOM 契约字样零触碰）；`data-op`/命令 id 零改动
- 待运行时冒烟补签（验证方案 1–5）：① 五项提示观感 ② 无提示不占位 ③ ⋮ 菜单同步 ④ mac ⌘ 风格 ⑤ 提示与绑定一致
