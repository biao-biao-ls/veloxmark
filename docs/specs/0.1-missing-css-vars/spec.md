# 0.1 补声明缺失的 CSS 变量

## What / Why

`--bg-inset`、`--fg-muted` 被 5 处规则消费但从未声明，静默失效（消费点样式回落到继承/空值）。补上 `.theme-light`/`.theme-dark` 双主题声明，让这 5 处样式按本意生效。

## 背景与现状

- 消费点（`src/renderer/src/styles.css`）：`.sb-autosave-dirty`(L232 color)、`.table-insert-sniff`(L2784–2785 bg+color)、`.vm-mermaid-lightbox-zoom`(L3125–3126 bg+color)
- 声明点：`--bg-inset`/`--fg-muted` 在 `:root`/`.theme-light`/`.theme-dark` 均不存在（全仓 grep 仅消费无声明）
- 词表现状：`--fg-dim`（次要文本，AA 目标）、`--fg-disabled`（弱化禁用）、`--widget-surface`（块 widget 面）

## 验收标准（AC）

1. `.theme-light` 与 `.theme-dark` 各声明 `--bg-inset`、`--fg-muted`，位置在既有 color 分区（chrome / text）内
2. 5 处消费规则的 var() 全部可解析（grep 无「消费而无声明」残留）
3. 双主题下 chip/readout（表格插入 sniff、lightbox 缩放读数、autosave dirty 灯）可读，无视觉破损（人工冒烟）
4. 不改动既有 token 值；不新增选择器级 `.theme-dark` 补丁（Constitution 对齐）

## 约束

- 遵循仓库 F08「语义拆分」先例：新 token 可以与既有 token 同值、但语义独立（注释注明）
- 注释风格随仓库（注明语义与取值理由）

## 方案（轻）

- `--bg-inset`（凹陷 chip/readout 面）：light `#f2f2f2`、dark `#2a2a2b`（比 `--bg` 深/浅一档，不透明实色便于对比度核算）
- `--fg-muted`（chip 元数据弱文本）：light `#6b6b6b`、dark `#9a9a9a`（今日与 `--fg-dim` 同值，语义独立：dim=次要正文文本，muted=chip/读数元数据）
- 声明进 `.theme-light` 的 `/* color: chrome */`（bg-inset）/`/* color: text */`（fg-muted）分区，dark 同步
