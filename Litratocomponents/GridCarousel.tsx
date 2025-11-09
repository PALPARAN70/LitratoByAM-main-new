'use client'
import React, { useEffect, useRef, useState } from 'react'
import { IoIosArrowRoundForward, IoIosArrowRoundBack } from 'react-icons/io'
import Image from 'next/image'
import { type PublicGrid } from '../schemas/functions/BookingRequest/loadGridsPublic'

type Props = {
  grids: PublicGrid[]
  selectedGrids: string[]
  onSelectAction: (gridNames: string[]) => void
  maxSelections?: number
  emptyText?: string
}

/**
 * Horizontal draggable carousel for grid selection.
 * - Supports multi-selection with max limit
 * - Drag-to-scroll with mouse and touch
 * - Pagination dots and arrow navigation
 */
export default function GridCarousel({
  grids,
  selectedGrids,
  onSelectAction,
  maxSelections = 2,
  emptyText = 'No grids available yet.',
}: Props) {
  const scrollerRef = useRef<HTMLDivElement | null>(null)
  const itemRefs = useRef<Array<HTMLDivElement | null>>([])
  const [activeIndex, setActiveIndex] = useState<number>(0)
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
      grids.length - 1,
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

  useEffect(() => {
    updateActiveFromScroll()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [grids.length])

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
    const walk = (x - startXRef.current) * 1.5
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

  const handleGridToggle = (gridName: string) => {
    const isSelected = selectedGrids.includes(gridName)
    if (isSelected) {
      onSelectAction(selectedGrids.filter((n) => n !== gridName))
    } else if (selectedGrids.length < maxSelections) {
      onSelectAction([...selectedGrids, gridName])
    }
  }

  if (!grids?.length) {
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
        onWheel={(e) => {
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
        <div className="shrink-0 basis-[8px]" aria-hidden />
        {grids.map((g, index) => {
          const picked = selectedGrids.includes(g.grid_name)
          const atLimit = selectedGrids.length >= maxSelections && !picked
          const imgSrc = g.image_url || '/Images/litratobg.jpg'
          return (
            <div
              key={g.id}
              className="shrink-0 snap-center"
              style={{ width: 270 }}
              ref={(el) => {
                itemRefs.current[index] = el
              }}
            >
              <button
                type="button"
                disabled={atLimit}
                aria-pressed={picked}
                className={`group w-full overflow-hidden rounded-xl border shadow-sm transition focus:outline-none ${
                  picked
                    ? 'border-2 border-red-500 ring-2 ring-red-500 ring-offset-2 ring-offset-white'
                    : 'border-gray-200 focus-visible:ring-2 focus-visible:ring-litratored'
                } ${
                  atLimit ? 'opacity-60 cursor-not-allowed' : 'hover:shadow-md'
                }`}
                onClick={() => handleGridToggle(g.grid_name)}
              >
                <div className="relative w-full h-[200px] bg-gray-100">
                  <Image
                    src={imgSrc}
                    alt={g.grid_name}
                    fill
                    className="object-cover"
                  />
                  {picked && <div className="absolute inset-0 bg-black/30" />}
                </div>
                <div className="p-2 text-center">
                  <span className="text-sm font-medium text-litratoblack">
                    {g.grid_name}
                  </span>
                </div>
              </button>
            </div>
          )
        })}
        <div className="shrink-0 basis-[8px]" aria-hidden />
      </div>

      {/* Gradient fades left/right */}
      <div className="pointer-events-none absolute left-0 top-0 h-full w-10 bg-gradient-to-r from-white to-transparent" />
      <div className="pointer-events-none absolute right-0 top-0 h-full w-10 bg-gradient-to-l from-white to-transparent" />

      {/* Controls inline: left arrow, dots, right arrow */}
      <div className="mt-3 flex items-center justify-center gap-2">
        <button
          type="button"
          aria-label="Previous grid"
          className="w-12 h-12 flex items-center justify-center bg-white hover:bg-gray-50 transition rounded-sm focus:outline-none"
          onClick={() => scrollByStep('left')}
        >
          <IoIosArrowRoundBack size={24} className="text-gray-700" />
        </button>
        <div className="flex items-center gap-1">
          {grids.map((_, i) => (
            <button
              key={i}
              type="button"
              aria-label={`Go to grid ${i + 1}`}
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
          aria-label="Next grid"
          className="w-12 h-12 flex items-center justify-center bg-white hover:bg-gray-50 transition rounded-sm focus:outline-none"
          onClick={() => scrollByStep('right')}
        >
          <IoIosArrowRoundForward size={24} className="text-gray-700" />
        </button>
      </div>
    </div>
  )
}
