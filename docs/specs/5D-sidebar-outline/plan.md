# 5D 侧边栏大纲精致度 实施方案

## 技术决策与理由

**现状核实**：`chrome.css` L328–358 已有 `.outline-item` 基础/hover/active 与 `.outline-l1`（仅 font-weight 600）；`Outline.tsx` L33 输出 `outline-l${item.level}`，**l2–l6 无任何 CSS** → 多级标题零缩进。长标题 nowrap + ellipsis 已有，缺 `title` 提示。

**决策**：

- **D1 层级缩进 = `--space-3`（12px）/级**：`.outline-l1` 起排不动，`outline-l2`–`l6` 各加 `padding-left: calc(12px + (N-2) * var(--space-3))` 的阶梯（或等价单条 calc）。Constitution 纪律：间距只用 `--space-*`，不引入裸 px 新值。
- **D2 active 态保持语义、补 Typora 式左侧强调条**：现状加粗 + `--accent` 色保留；追加 2px 左侧强调条（`box-shadow: inset 2px 0 0 var(--accent)`——**不用 border-left**，border 参与盒模型会推移文字导致 hover 抖动）。
- **D3 `title` 属性 = 标题全文**（`Outline.tsx` 一行 DOM 属性），无 i18n key。
- **D4 hover 质感对齐文件树**：现状 `--code-bg` 与 filetree 一致，不动；折叠钮（P18）不动。

## 文件切法

| 源 | 改动 |
|---|---|
| `styles/chrome.css` | 大纲区（L328–358）：l2–l6 缩进阶梯 + active 左侧条 |
| `components/Outline.tsx` | `<button title={item.text}>`（一行） |

不动：`outline/extract.ts`、P18 折叠交互、i18n 字典（无新 key）。

## 状态/契约归属

- 无模块状态；e2e 缝零触碰；P18 `outline-fold` 契约不动。

## import 改动面

无。

## 任务拆分

| # | 任务 | 依赖 |
|---|---|---|
| T1 | 层级缩进阶梯 + active 左侧条（D1/D2） | [P] T2 |
| T2 | `title` 提示（D3） | [P] T1 |

## 验证方案

```bash
npm run typecheck && npm run test:unit
```

- 人工冒烟：六级标题缩进一眼可辨；大纲点击跳转、折叠/展开、滚动跟随 active 切换无抖动；长标题截断 + hover title；文件树模式无回归；深浅主题
