'use client'

import { useRef } from 'react'
import { IoIosArrowRoundBack, IoIosArrowRoundForward } from 'react-icons/io'
import PromoCard from './Service_Card'

type PromoItem = {
  imageSrc: string
  title: string
  price: string
  descriptions: string[]
}

type PromoCarouselProps = {
  promos: PromoItem[]
}

const PromoCarousel = ({ promos }: PromoCarouselProps) => {
  const containerRef = useRef<HTMLDivElement>(null)

  const scroll = (direction: 'left' | 'right') => {
    const container = containerRef.current
    if (!container) return

    const sampleCard = container.querySelector<HTMLElement>('[data-promo-card]')
    const cardWidth = sampleCard ? sampleCard.offsetWidth : 280
    const gap = 24

    container.scrollBy({
      left: (cardWidth + gap) * (direction === 'left' ? -1 : 1),
      behavior: 'smooth',
    })
  }

  return (
    <div className="relative w-full">
      <div className="absolute inset-y-0 left-0 z-20 w-16 pointer-events-none bg-gradient-to-r from-white via-white/80 to-transparent" />
      <div className="absolute inset-y-0 right-0 z-20 w-16 pointer-events-none bg-gradient-to-l from-white via-white/80 to-transparent" />

      <button
        type="button"
        aria-label="Previous promotion"
        onClick={() => scroll('left')}
        className="absolute left-4 top-1/2 z-30 -translate-y-1/2 rounded-full bg-transparent p-1 transition hover:bg-white/70"
      >
        <IoIosArrowRoundBack className="text-4xl text-litratoblack" />
      </button>

      <button
        type="button"
        aria-label="Next promotion"
        onClick={() => scroll('right')}
        className="absolute right-4 top-1/2 z-30 -translate-y-1/2 rounded-full bg-transparent p-1 transition hover:bg-white/70"
      >
        <IoIosArrowRoundForward className="text-4xl text-litratoblack" />
      </button>

      <div
        ref={containerRef}
        className="flex gap-6 overflow-x-auto px-6 py-6 scroll-smooth [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {promos.map((promo) => (
          <div key={promo.title} className="flex-shrink-0">
            <PromoCard {...promo} />
          </div>
        ))}
      </div>
    </div>
  )
}

export default PromoCarousel
