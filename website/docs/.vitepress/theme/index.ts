import { h } from 'vue'
import DefaultTheme from 'vitepress/theme'
import type { Theme } from 'vitepress'
import './custom.css'

const CHECK_SVG = {
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  'stroke-width': '2.5',
  'stroke-linecap': 'round',
  'stroke-linejoin': 'round'
}

function TrustRow() {
  return h(
    'ul',
    { class: 'vm-trust' },
    [
      ['macOS · Windows · Linux'],
      ['Local-first, no account'],
      ['MIT licensed, forever']
    ].map(([text]) =>
      h('li', [
        h('svg', CHECK_SVG, [h('path', { d: 'M20 6 9 17l-5-5' })]),
        text
      ])
    )
  )
}

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
