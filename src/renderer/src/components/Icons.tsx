/**
 * Titlebar icon set — inline SVGs using currentColor so they inherit the
 * theme's foreground and hover states. Stroke-based, Lucide-style geometry.
 */

type IconProps = { size?: number }

function Svg({ size = 16, children }: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  )
}

export function SunIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
    </Svg>
  )
}

export function MoonIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
    </Svg>
  )
}

/** Outline sidebar toggle. */
export function PanelIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <path d="M9 3v18" />
    </Svg>
  )
}

export function MinimizeIcon({ size = 14, ...rest }: IconProps) {
  return (
    <Svg size={size} {...rest}>
      <path d="M5 12h14" />
    </Svg>
  )
}

export function MaximizeIcon({ size = 14, ...rest }: IconProps) {
  return (
    <Svg size={size} {...rest}>
      <rect x="5" y="5" width="14" height="14" rx="1" />
    </Svg>
  )
}

export function CloseIcon({ size = 14, ...rest }: IconProps) {
  return (
    <Svg size={size} {...rest}>
      <path d="M6 6l12 12M18 6L6 18" />
    </Svg>
  )
}
