'use client'
import React, { useEffect, useRef, useState } from 'react'
import { IoIosArrowRoundForward, IoIosArrowRoundBack } from 'react-icons/io'
import PromoCard from './Service_Card'
import { type PackageDto } from '../schemas/functions/BookingRequest/loadPackages'

type Props = {
  packages: PackageDto[]
  selectedId: number | null
  onSelectAction: (pkg: PackageDto) => void // renamed to satisfy client component action naming
  emptyText?: string
}

/**
 * Horizontal snap carousel for package selection.
 * - Uses existing PromoCard for visual consistency
 * - Keyboard accessible (tab into container then use arrow buttons)
 */
export default function PackageCarousel({
  packages,
  selectedId,
  onSelectAction,
  emptyText = 'No packages to display.',
}: Props) {
  const scrollerRef = useRef<HTMLDivElement | null>(null)
  const itemRefs = useRef<Array<HTMLDivElement | null>>([])
  const [activeIndex, setActiveIndex] = useState<number>(
    Math.max(
      0,
      packages.findIndex((p) => p.id === selectedId)
    )
  )
  const tickingRef = useRef(false)
  const isDraggingRef = useRef(false)
  const startXRef = useRef(0)
  const scrollLeftRef = useRef(0)

  const scrollToIndex = (index: number) => {
    const el = itemRefs.current[index]
    if (el) {
      el.scrollIntoView({
        behavior: 'smooth',
        inline: 'center',
        block: 'nearest',
      })
      setActiveIndex(index)
    }
  }

  const scrollByStep = (dir: 'left' | 'right') => {
    const target = Math.min(
      packages.length - 1,
      Math.max(0, activeIndex + (dir === 'left' ? -1 : 1))
    )
    scrollToIndex(target)
  }

  const updateActiveFromScroll = () => {
    const container = scrollerRef.current
    if (!container) return
    const cRect = container.getBoundingClientRect()
    const centerX = cRect.left + cRect.width / 2
    let best = 0
    let bestDist = Infinity
    itemRefs.current.forEach((node, i) => {
      if (!node) return
      const r = node.getBoundingClientRect()
      const mid = r.left + r.width / 2
      const d = Math.abs(mid - centerX)
      if (d < bestDist) {
        bestDist = d
        best = i
      }
    })
    setActiveIndex(best)
  }

  // Sync dots with externally selected id
  useEffect(() => {
    const idx = packages.findIndex((p) => p.id === selectedId)
    if (idx >= 0) setActiveIndex(idx)
  }, [selectedId, packages])

  useEffect(() => {
    updateActiveFromScroll()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [packages.length])

  // Drag handlers for mouse
  const handleMouseDown = (e: React.MouseEvent) => {
    const el = scrollerRef.current
    if (!el) return
    isDraggingRef.current = true
    startXRef.current = e.pageX - el.offsetLeft
    scrollLeftRef.current = el.scrollLeft
    el.style.cursor = 'grabbing'
    el.style.userSelect = 'none'
  }

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDraggingRef.current) return
    e.preventDefault()
    const el = scrollerRef.current
    if (!el) return
    const x = e.pageX - el.offsetLeft
    const walk = (x - startXRef.current) * 1.5 // scroll speed multiplier
    el.scrollLeft = scrollLeftRef.current - walk
  }

  const handleMouseUp = () => {
    const el = scrollerRef.current
    if (el) {
      el.style.cursor = 'grab'
      el.style.userSelect = 'auto'
    }
    isDraggingRef.current = false
  }

  const handleMouseLeave = () => {
    if (isDraggingRef.current) {
      handleMouseUp()
    }
  }

  // Touch handlers for mobile
  const handleTouchStart = (e: React.TouchEvent) => {
    const el = scrollerRef.current
    if (!el) return
    isDraggingRef.current = true
    startXRef.current = e.touches[0].pageX - el.offsetLeft
    scrollLeftRef.current = el.scrollLeft
  }

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDraggingRef.current) return
    const el = scrollerRef.current
    if (!el) return
    const x = e.touches[0].pageX - el.offsetLeft
    const walk = (x - startXRef.current) * 1.5
    el.scrollLeft = scrollLeftRef.current - walk
  }

  const handleTouchEnd = () => {
    isDraggingRef.current = false
  }

  if (!packages?.length) {
    return <p className="text-sm text-gray-500 text-center">{emptyText}</p>
  }

  return (
    <div className="relative">
      <div
        ref={scrollerRef}
        className="flex gap-3 overflow-x-auto pb-2 snap-x snap-mandatory scroll-smooth [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden cursor-grab active:cursor-grabbing"
        style={{ scrollSnapType: 'x mandatory' }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        // Hide scrollbar in WebKit
        onWheel={(e) => {
          // Enable mouse wheel horizontal scroll (shift not required)
          const el = scrollerRef.current
          if (!el) return
          if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
            el.scrollLeft += e.deltaY
            e.preventDefault()
          }
        }}
        onScroll={() => {
          if (tickingRef.current) return
          tickingRef.current = true
          requestAnimationFrame(() => {
            updateActiveFromScroll()
            tickingRef.current = false
          })
        }}
      >
        {/* padding to center first/last on small screens */}
        <div className="shrink-0 basis-[8px]" aria-hidden />
        {packages.map((pkg, index) => (
          <div
            key={pkg.id}
            className="shrink-0 snap-center"
            style={{ width: 270 }}
            ref={(el) => {
              itemRefs.current[index] = el
            }}
          >
            <PromoCard
              imageSrc={pkg.image_url || '/Images/litratobg.jpg'}
              title={pkg.package_name}
              price={`₱${Number(pkg.price).toLocaleString()}`}
              descriptions={[pkg.description || 'Package']}
              selected={selectedId === pkg.id}
              onSelect={() => {
                setActiveIndex(index)
                onSelectAction(pkg)
              }}
            />
          </div>
        ))}
        <div className="shrink-0 basis-[8px]" aria-hidden />
      </div>

      {/* Gradient fades left/right */}
      <div className="pointer-events-none absolute left-0 top-0 h-full w-10 bg-gradient-to-r from-white to-transparent" />
      <div className="pointer-events-none absolute right-0 top-0 h-full w-10 bg-gradient-to-l from-white to-transparent" />

      {/* Controls inline and centered: left arrow, dots, right arrow (kept close together) */}
      <div className="mt-3 flex items-center justify-center gap-2">
        <button
          type="button"
          aria-label="Previous package"
          className="w-12 h-12 flex items-center justify-center bg-white hover:bg-gray-50 transition rounded-sm focus:outline-none"
          onClick={() => scrollByStep('left')}
        >
          <IoIosArrowRoundBack size={24} className="text-gray-700" />
        </button>
        <div className="flex items-center gap-1">
          {packages.map((_, i) => (
            <button
              key={i}
              type="button"
              aria-label={`Go to package ${i + 1}`}
              className={`transition-colors ${
                i === activeIndex ? 'bg-litratoblack' : 'bg-gray-300'
              }`}
              style={{ width: 10, height: 10, borderRadius: 2 }}
              onClick={() => scrollToIndex(i)}
            />
          ))}
        </div>
        <button
          type="button"
          aria-label="Next package"
          className="w-12 h-12 flex items-center justify-center bg-white hover:bg-gray-50 transition rounded-sm focus:outline-none"
          onClick={() => scrollByStep('right')}
        >
          <IoIosArrowRoundForward size={24} className="text-gray-700" />
        </button>
      </div>
    </div>
  )
}
