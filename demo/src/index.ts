import { Renderer } from '@plutotcool/fsv'

;(async () => {
  let scrollHeight: number

  const viewportMeasurer = document.querySelector<HTMLElement>('.viewport-measurer')!
  const frames = document.querySelector('span')!
  const canvas = document.querySelector('canvas')!
  const renderer = new Renderer({ canvas })

  await renderer.load('/video.fsv')

  document.body.classList.remove('loading')

  onResize()

  addEventListener('resize', onResize, { passive: true })
  addEventListener('scroll', onScroll, { passive: true })

  function onResize() {
    scrollHeight = document.documentElement.scrollHeight - viewportMeasurer.offsetHeight
    onScroll()
  }

  function onScroll() {
    renderer.progress(mod(window.scrollY / scrollHeight * 2, 1))
    frames.textContent = `Frame ${(renderer.pendingFrame || 0)
      .toString()
      .padStart(4, '0')
    }`
  }

  function mod(a: number, b: number): number {
    return ((a % b) + b) % b;
  }
})()
