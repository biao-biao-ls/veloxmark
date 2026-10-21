import { h, defineComponent } from 'vue'
import DefaultTheme from 'vitepress/theme'
import { useData } from 'vitepress'
import type { Theme } from 'vitepress'
import { EN } from '../locales/en'
import { ZH } from '../locales/zh'
import { JA } from '../locales/ja'
import { KO } from '../locales/ko'
import { ES } from '../locales/es'
import { PT } from '../locales/pt'
import { FR } from '../locales/fr'
import { DE } from '../locales/de'
import { RU } from '../locales/ru'
import './custom.css'

const CHECK_SVG = {
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  'stroke-width': '2.5',
  'stroke-linecap': 'round',
  'stroke-linejoin': 'round'
}

/** Trust ticks per language, keyed by BCP-47 primary subtag. */
const TRUST_BY_LANG: Array<{ prefix: string; ticks: readonly string[] }> = [
  { prefix: 'zh', ticks: ZH.trustTicks },
  { prefix: 'ja', ticks: JA.trustTicks },
  { prefix: 'ko', ticks: KO.trustTicks },
  { prefix: 'es', ticks: ES.trustTicks },
  { prefix: 'pt', ticks: PT.trustTicks },
  { prefix: 'fr', ticks: FR.trustTicks },
  { prefix: 'de', ticks: DE.trustTicks },
  { prefix: 'ru', ticks: RU.trustTicks },
  { prefix: 'en', ticks: EN.trustTicks }
]

/** Trust ticks under the hero CTAs — localized via the website locale packs. */
const TrustRow = defineComponent({
  name: 'TrustRow',
  setup() {
    const { lang } = useData()
    return () => {
      const code = lang.value.slice(0, 2).toLowerCase()
      const ticks =
        TRUST_BY_LANG.find((e) => e.prefix === code)?.ticks ?? EN.trustTicks
      return h(
        'ul',
        { class: 'vm-trust' },
        ticks.map((text) =>
          h('li', [
            h('svg', CHECK_SVG, [h('path', { d: 'M20 6 9 17l-5-5' })]),
            text
          ])
        )
      )
    }
  }
})

function setupReveal(): void {
  if (typeof window === 'undefined') return
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  const mark = (): void => {
    document.querySelectorAll('.vm-reveal:not(.is-visible)').forEach((el) => {
      if (reduce) {
        el.classList.add('is-visible')
        return
      }
      revealObserver.observe(el)
    })
  }
  const revealObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible')
          revealObserver.unobserve(entry.target)
        }
      })
    },
    { threshold: 0.12, rootMargin: '0px 0px -8% 0px' }
  )
  mark()
  // VitePress swaps content on route change without a full reload.
  if (typeof MutationObserver !== 'undefined') {
    new MutationObserver(mark).observe(document.body, { childList: true, subtree: true })
  }
}

export default {
  extends: DefaultTheme,
  Layout: () =>
    h(DefaultTheme.Layout, null, {
      // Trust ticks between the hero CTA row and the product shot
      'home-hero-actions-after': () => h(TrustRow)
    }),
  enhanceApp() {
    if (typeof window !== 'undefined') {
      if (document.readyState === 'complete') setupReveal()
      else window.addEventListener('load', setupReveal, { once: true })
    }
  }
} satisfies Theme
