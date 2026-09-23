# 4.4 复核剩余业务回调 — 实施计划

## 审计表（AC1 交付物）

| # | 域 | App 位置（节） | 决议 | 理由 |
|---|---|---|---|---|
| 1 | showToast + toastRef | 通用 | **keep** | UI 外壳原语，全组件面消费；下沉成 hook 收益为零 |
| 2 | updateOutline / updateActiveHeading | 大纲投影 | **keep** | 多 hook 入参共享（useFileOps/useDocIo/updateOutline），App 是装配点 |
| 3 | **折叠同步（P18）** | L167–220 | **sink → useFoldSync** | 明显独立域（任务点名）：纯 viewRef/session 读写，边界干净 |
| 4 | **会话持久化写侧（P03）** | L257–307 | **sink → useSessionPersist** | 明显独立域（任务点名）：状态→store/IPC 单向写，无编辑器耦合 |
| 5 | 原生菜单订阅（openRecent/clearRecent/tab 命令/closeTabOrWindow） | L308–337 | **keep（4.5 现场）** | 双派发缺陷现场，4.5 重构收敛；本次不触避免同域双改 |
| 6 | 启动 restore effect | L349–417 | **keep** | boot 编排（workspace/fileOps/toast/sidebarMode 纠缠）= App 装配职责 |
| 7 | P12 drafts（checkDrafts + installP12Handle + onQueryClose） | L422–511 | **keep** | `__veloxP12` 缝接线 + 对话框编排 |
| 8 | pref→IPC 桥（folder options）+ Compartment 热切换群 | L514–573 | **keep** | 薄 glue（1 行推送/开关），无域可言 |
| 9 | startSidebarResize | L575–588 | **keep** | UI 交互局部状态 |
| 10 | create editor effect | L590–680 | **keep** | 编辑器装配根；同步监听触 syncFoldedKeysRef（迁移后透传） |
| 11 | refreshImages + 图片 IPC + 焦点监听 | L681–704 | **keep** | 薄桥 |
| 12 | goToHeading / toggleOutline | L705–731 | **keep** | UI 导航 glue |
| 13 | 语言/原生菜单（P14）+ stats 桥 | L733–816 | **keep** | 薄桥；stats 防抖体如后续膨胀可再议（不进本清单） |
| 14 | 全局搜索 / mermaid·callout·table 插入对话框 / formatDocument | L818–1051 | **keep** | 对话框表单态与命令 glue（表单态是对话框本地） |
| 15 | P25 mermaid pin | L1052–1137 | **keep** | 局部预览态 + 一处 patchSession |
| 16 | P17 链接导航 + 失效重校验 | L1139–1310 | **keep** | 域大但属导航编排；缝/定时器/IPC 订阅交织 |
| 17 | useE2eSeams 群 + useMenus/useFileOps 等 hook 接线 | 尾段 | **keep** | 缝契约与既有 hook 组装点 |

## 技术决策与理由

- **两 hook 均纯搬移**：body/注释/effect dep 数组逐字迁移（含 `eslint-disable react-hooks/exhaustive-deps` 位置）；无等价改写点。
- **依赖注入显式化**：`useSessionPersist` 入参是 7 个原始值/稳定回调（不传 `fileOps`/`session` 对象本体——3A「对象字面量勿进 dep」教训的反面：显式字段让 dep 数组诚实）。
- **`useFoldSync` 返回 Ref 不返回裸回调**：create-editor 闭包与 `useP18Seam` 消费的都是 ref（读最新闭包），保持 ref 镜像模式；`RestoreFoldsForRef`/`ViewRef`/`FilePathRef` 类型直引 `e2e/seams/types.ts`（单一真源），本地 `SyncFoldedKeysRef = RefObject<() => void>` 同形状声明。
- **p18.ts 注释校正**：「App's fold-sync effect writes it」→ 「useFoldSync writes it」（注释准确性，行为零涉）。

## 文件切法

| 源（App.tsx） | 目标 | 内容 |
|---|---|---|
| L167–220 | `hooks/useFoldSync.ts` | foldedKeys state + foldSigRef + syncFoldedKeys(+Ref) + restoreFoldsFor(+Ref) + filePath effect |
| L257–307 | `hooks/useSessionPersist.ts` | 3× sidebar patchSession + tabs persist + recentItems 校验 + setRecentFiles 推送 |
| 两域原位 | App.tsx | 删除 + 两 hook 调用接线（foldedKeys 下传 Outline；recentItems 下传 useMenus；两 ref 下传 create-editor/useP18Seam） |

hook 返回形状：

```ts
// useFoldSync({ viewRef, filePathRef, suppressDirtyRef, filePath })
//   → { foldedKeys: ReadonlySet<string>,
//       syncFoldedKeysRef: RefObject<() => void>,
//       restoreFoldsForRef: RestoreFoldsForRef }
// useSessionPersist({ sessionSynced, showOutline, sidebarMode, sidebarWidth,
//                     persistTabsSession, tabInfos, recentFiles })
//   → { recentItems: RecentItem[] }
```

## 验证方案（converge）

1. `npm run typecheck && npm run test:unit` 全绿。
2. `npx madge --circular --extensions ts,tsx src/renderer/src` 0 cycles。
3. grep 断言：`patchSession({ sidebar` / `headingFolds` / `persistTabsSession()` / `setRecentFiles` 写点随域迁移（App 原位 0 残留，除 restore 读取/mermaid pin 等审计表注明项）；`restoreFoldsForRef`/`syncFoldedKeysRef` 消费点不变。
4. 人工冒烟（行为不变类）：折叠几节 → 切文件回来折叠仍在（session headingFolds）；侧栏显隐/模式/宽度改后重启保留；tabs 开关后重启恢复；Recent Files 校验（删一个文件看菜单变灰/消失）。
