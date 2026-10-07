/**
 * "Fly to cart": a round copy of the coffee photo arcs from where the guest tapped
 * to the cart button (any visible element with data-cart-target), which then bumps.
 * Skipped for prefers-reduced-motion (the cart still bumps).
 */
export function flyToCart(from: Element | null | undefined, imageUrl?: string) {
  const target = [...document.querySelectorAll<HTMLElement>('[data-cart-target]')]
    .find((el) => el.offsetParent !== null && el.getBoundingClientRect().width > 0)
  if (!target) return
  const bump = () => {
    target.classList.remove('g-cart-bump')
    void target.offsetWidth // restart the animation
    target.classList.add('g-cart-bump')
  }
  if (!from || !imageUrl || matchMedia('(prefers-reduced-motion: reduce)').matches) {
    bump()
    return
  }

  const a = from.getBoundingClientRect()
  const b = target.getBoundingClientRect()
  const size = Math.min(96, a.width, a.height)
  const dot = document.createElement('img')
  dot.src = imageUrl
  dot.alt = ''
  dot.className = 'g-fly-dot'
  Object.assign(dot.style, {
    width: `${size}px`, height: `${size}px`,
    left: `${a.left + a.width / 2 - size / 2}px`, top: `${a.top + a.height / 2 - size / 2}px`,
  })
  document.body.appendChild(dot)

  const dx = b.left + b.width / 2 - (a.left + a.width / 2)
  const dy = b.top + b.height / 2 - (a.top + a.height / 2)
  const lift = Math.min(-80, dy - 120) // arc: rise first, then drop into the cart
  const anim = dot.animate([
    { transform: 'translate(0, 0) scale(1)', opacity: 1 },
    { transform: `translate(${dx * 0.45}px, ${lift}px) scale(0.7)`, opacity: 1, offset: 0.45 },
    { transform: `translate(${dx}px, ${dy}px) scale(0.18)`, opacity: 0.6 },
  ], { duration: 700, easing: 'cubic-bezier(0.45, 0, 0.25, 1)' })
  anim.onfinish = () => { dot.remove(); bump() }
}
