import { useRef, type ReactNode } from 'react'
import { LeftOutlined, RightOutlined } from '@ant-design/icons'

/** One horizontally scrolling row of cards, with left / right buttons on desktop. */
export function ScrollRow({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)
  const scroll = (dir: 1 | -1) => {
    const el = ref.current
    if (el) el.scrollBy({ left: dir * el.clientWidth * 0.8, behavior: 'smooth' })
  }

  return (
    <div className="g-scroll-wrap">
      <button type="button" className="g-scroll-nav is-prev" aria-label="Cuộn sang trái" onClick={() => scroll(-1)}>
        <LeftOutlined />
      </button>
      <div className="g-scroll-row" ref={ref}>{children}</div>
      <button type="button" className="g-scroll-nav is-next" aria-label="Cuộn sang phải" onClick={() => scroll(1)}>
        <RightOutlined />
      </button>
    </div>
  )
}
