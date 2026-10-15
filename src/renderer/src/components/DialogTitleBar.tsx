import { t } from '../i18n'
import { CloseIcon } from './Icons'

/**
 * F08 仿系统 chrome：弹框标题栏跟随系统窗口样式。
 * mac = 红绿灯三点（红=真关闭，黄/绿装饰置灰）+ 标题居中；
 * Win/Linux = 标题居左 + 右侧 caption ×（复用主窗 .wc-btn/.wc-close 语言）。
 * lights：'close-only' 小弹框仅红点/×；'full' 面板型弹框三灯齐全。
 */
export type DialogLights = 'full' | 'close-only'

interface Props {
  title: string
  onClose: () => void
  /** mac 红绿灯形态；Win 恒为 ×。默认 'full'。 */
  lights?: DialogLights
  /** 转发给关闭控件（Preferences 开屏聚焦它）。 */
  closeRef?: React.Ref<HTMLButtonElement>
  /** Export 导出中禁用关闭（与 Esc/overlay 守卫同拍）。 */
  closeDisabled?: boolean
}

export default function DialogTitleBar({
  title,
  onClose,
  lights = 'full',
  closeRef,
  closeDisabled
}: Props): React.JSX.Element {
  const isMac = window.api.platform === 'darwin'
  // 宿主弹框在 overlay 层绑 Enter（确认/选取）——关闭按钮获得焦点时
  // 拦下 Enter/Space 的冒泡，避免按下关闭却触发了宿主的确认。
  const stopConfirmKeys = (e: React.KeyboardEvent): void => {
    if (e.key === 'Enter' || e.key === ' ') e.stopPropagation()
  }
  const closeBtnAttrs = {
    ref: closeRef,
    'data-testid': 'dialog-titlebar-close',
    'aria-label': t('dialog.close'),
    onClick: onClose,
    disabled: closeDisabled,
    onKeyDown: stopConfirmKeys
  }
  return isMac ? (
    <div className="dialog-titlebar dialog-titlebar-mac" data-testid="dialog-titlebar">
      <div className="dt-lights">
        <button type="button" className="dt-light dt-light-close" {...closeBtnAttrs} />
        {/* 装饰灯：span 不进 Tab 环 */}
        {lights === 'full' && (
          <>
            <span className="dt-light dt-light-min" aria-hidden="true" />
            <span className="dt-light dt-light-zoom" aria-hidden="true" />
          </>
        )}
      </div>
      <div className="dt-title">{title}</div>
    </div>
  ) : (
    <div className="dialog-titlebar dialog-titlebar-win" data-testid="dialog-titlebar">
      <div className="dt-title">{title}</div>
      <button type="button" className="wc-btn wc-close dt-caption-close" {...closeBtnAttrs}>
        <CloseIcon />
      </button>
    </div>
  )
}
