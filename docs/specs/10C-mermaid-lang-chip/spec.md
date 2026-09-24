# 10C spec — mermaid 聚焦语言 chip + 语言切换（10.3 / ⑪）

> 看板任务：⑪ 10.3（`docs/markdown-ux-optimization.md` 实施优先级 P1）。10A spec 将本项显式划出 scope（「另立/后续 spec」），本文件即该后续 spec。依赖 ⑦（9A）语言列表——**前置已达成**（9A 收敛记录注明「语言列表/切换机制通用挂载全部 fence，⑪ 前置达成」）。

## 背景 / 差距（what & why）

对照基准截图 `temp/typora/mermaid-focus.png`：Typora 聚焦 mermaid 时双区（源码 + 实时预览）之上带一枚「mermaid」语言 chip，点击可切换 fence 语言（mermaid ↔ 普通代码）。

VeloxMark 现状（机制面已基本齐备）：

- **chip 挂载**：9A 把 `CodeLangChip` 通用挂到一切聚焦 fence 的闭栏（`buildFocusedCodePanel` 全语言路径），mermaid 自动获 chip（`build.test.ts` 已钉 `chip(lang=mermaid)`）。
- **语言列表 + 切换**：9A `openCodeLangPicker`/`switchFenceLang` 通用机制含 mermaid（`LANG_COMMON_IDS` 常用区登记 + `LANG_EXTRA_IDS` 补全集）；`langDisplayName('mermaid')` 原样回显小写 id，与截图一致。
- **渲染分派**：`enterFencedCode` 按 info 串分派（mermaid → `MermaidWidget`/聚焦态 `MermaidPreviewWidget`，其余 → `CodeBlockWidget`）——切走/切回语义自然成立。

**真实缺口 = AC 无回归钉**：`MermaidPreviewWidget` 的出现/撤除、切走后按普通代码块渲染、切回恢复图表渲染，装饰层 dispatch 目前零断言覆盖。本项为**近零代码收尾**：把看板 AC 钉进 `build.test.ts`，位置偏差显式记录。

**Why**：⑪ 的 AC 是行为契约（切走/切回），无测试则后续重构（⑮⑯⑱ 观感批次会动 chrome）可静默破坏分派；补钉成本极低。

## chip 位置决策（显式记录）

看板允许「右上/右下角」。实现取 **9A 公约：源码面板闭栏右下**（行 `position: relative` + chip `position: absolute`，零布局成本）。与 `mermaid-focus.png` 的「预览区右上」为**同一拼缝**的面板侧/预览侧之差——不为 mermaid 单独发明第二挂点（红线 6 精神 + ⑱ 块级 chrome 规范将统一收口位置语义）。9A 测试已钉 chip 落闭栏（`from === CLOSE_FROM`），本 spec 接受该位置即为达标。

## AC（可测试）

1. **聚焦双区含 chip**：光标在 mermaid fence 内 → 面板 + `CodeLangChip(lang=mermaid)` + 尾随 `MermaidPreviewWidget`（block widget）；无 `MermaidWidget`。
2. **切走（聚焦中）**：info 串非 mermaid（如 `js`）的 fence 聚焦 → 无 `MermaidPreviewWidget`（普通代码面板，无图表预览）。
3. **切走（静息）**：info 串非 mermaid、内容为图语法文本 → `CodeBlockWidget` 按普通代码块渲染（分派只看 info 串，不嗅探内容）；无 `MermaidWidget`。
4. **切回（静息）**：info 串 `mermaid` → `MermaidWidget` 图表渲染恢复。
5. **位置**：chip 落闭栏（9A 公约，既有测试钉）；与基准图偏差如上节记录，接受即达标。
6. **缝零触碰**：e2e 字面量（`__velox*`/`data-op`/DOM 探针类名）零改动；生产代码零改动（若测试暴露缺口则最小修复并在 plan 实现细化记录）。

## Out of scope（明确不做）

- 语言列表/切换机制本体（9A 已收敛：picker/`switchFenceLang`/显示名/mermaid 登记）。
- chip 点击退出编辑（10A 已定：退出 = 光标移出；数学块的 ✓ chip 语义不外推）。
- ⑭ 10.2 静息态去边框盒、⑱ 11.9 块级 chrome 规范收口（另行任务）。
- `switchFenceLang` 状态编辑的单测（依赖语法树 resolve，属冒烟面——9A 惯例）。

## 约束引用

1（e2e 缝）→ AC6 diff grep；3（Widget 纪律）→ 反射 `constructor.name` 不渲染 widget（测试纪律）；5（i18n）→ 零新 key；7（循环依赖）→ 零 import 改动，madge 复核；9（单测纯逻辑）→ 仅装饰层分派断言（build.test.ts 既有惯用面）。
