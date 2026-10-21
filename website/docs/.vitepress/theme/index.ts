import DefaultTheme from 'vitepress/theme'
import type { Theme } from 'vitepress'
import './custom.css'

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
  enhanceApp() {
    if (typeof window !== 'undefined') {
      if (document.readyState === 'complete') setupReveal()
      else window.addEventListener('load', setupReveal, { once: true })
    }
  }
} satisfies Theme
