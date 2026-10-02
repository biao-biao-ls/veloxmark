/**
 * linkFloatSession — 链接 hover 浮层的会话纯逻辑（FE-05 换靶守卫）。
 *
 * 为什么独立成纯模块：RenderFloatHost 对同通道 retarget 复用组件实例只换
 * anchor prop（无 key），而编辑会话（draft/pin）绝不能跨锚点存活——否则
 * pin A 编辑态时 hover 到 B，确认会把 A 的 draft 写进 B（错链写回）。
 * 会话模型把「绑定谁 / 能否确认」收成可单测的纯函数，组件只做接线。
 *
 * 契约（linkFloatSession.test.ts 钉死）：
 *   - 会话始终绑定单个 anchor 身份；换靶 = 整会话重建（editing/draft 作废）；
 *   - 确认闸 canConfirmEdit：只有 editing 且仍绑在当前 anchor 上才放行——
 *     同时闭合「守卫 effect 落地前」的竞态窗口。
 */

/** 浮层会话：绑定单个 anchor 的展示/编辑状态。 */
export interface LinkFloatSession<A> {
  /** 会话绑定的锚点身份（换靶 = 新身份 = 新会话）。 */
  anchor: A
  /** 展示用 href 快照（动作时活体重读优先，此处兜底）。 */
  href: string
  editing: boolean
  /** 编辑草稿；非编辑态恒为空串。 */
  draft: string
}

/**
 * 绑定 anchor 的全新会话（挂载初始化与换靶守卫共用）。
 * 换靶后的展示值必须来自新锚点，编辑态/draft 一律作废。
 */
export function bindSession<A>(anchor: A, href: string): LinkFloatSession<A> {
  return { anchor, href, editing: false, draft: '' }
}

/** 进入编辑态：改绑发起编辑的 anchor 并预填 draft。 */
export function beginEdit<A>(
  session: LinkFloatSession<A>,
  anchor: A,
  draft: string
): LinkFloatSession<A> {
  return { anchor, href: session.href, editing: true, draft }
}

/** 输入草稿（只动 draft，绑定关系不变）。 */
export function updateDraft<A>(session: LinkFloatSession<A>, draft: string): LinkFloatSession<A> {
  return { ...session, draft }
}

/** 退出编辑态：draft 作废（pin 随 editing=false 释放）。 */
export function exitEdit<A>(session: LinkFloatSession<A>): LinkFloatSession<A> {
  return { ...session, editing: false, draft: '' }
}

/**
 * 确认闸：只有 editing 且会话仍绑在当前 anchor 上才允许写回。
 * 换靶竞态窗口（props.anchor 已是 B、会话还绑 A）在此被拒——防错链写回。
 */
export function canConfirmEdit<A>(session: LinkFloatSession<A>, anchor: A): boolean {
  return session.editing && session.anchor === anchor
}
