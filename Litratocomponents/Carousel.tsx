'use client'
import { useState } from 'react'
import { motion } from 'framer-motion'
import React from 'react'
import hanz from '../public/Images/events1.jpg'
import litratobg from '../public/Images/events5.jpg'
import gallery1 from '../public/Images/events2.jpg'
import Gallery4 from '../public/Images/events3.jpg'
import Gallery5 from '../public/Images/events4.jpg'
import { IoIosArrowRoundForward } from 'react-icons/io'
import { IoIosArrowRoundBack } from 'react-icons/io'
import { Antic_Didone } from 'next/font/google'

const anticDidone = Antic_Didone({
  subsets: ['latin'],
  weight: '400',
})
const ImageSlider = () => {
  const images = [hanz, litratobg, gallery1, Gallery4, Gallery5]
  const positions = ['center', 'left1', 'left', 'right', 'right1']
  const totalImages = images.length

  const [centerIndex, setCenterIndex] = useState(0)

  const getPositionIndexes = () =>
    Array.from(
      { length: totalImages },
      (_, i) => (i - centerIndex + totalImages) % totalImages
    )

  const positionIndexes = getPositionIndexes()

  const imageVariants = {
    center: { x: '0%', scale: 1, zIndex: 5 },
    left1: { x: '-50%', scale: 0.7, zIndex: 2 },
    left: { x: '-90%', scale: 0.5, zIndex: 1 },
    right: { x: '90%', scale: 0.5, zIndex: 1 },
    right1: { x: '50%', scale: 0.7, zIndex: 2 },
    hidden: { scale: 0, opacity: 0, zIndex: 0 },
  }

  const handlePrev = () => {
    setCenterIndex((prev) => (prev - 1 + totalImages) % totalImages)
  }

  const handleNext = () => {
    setCenterIndex((prev) => (prev + 1) % totalImages)
  }

  return (
    <div className="relative flex items-center flex-col select-none justify-center h-[90vh] overflow-hidden bg-white">
      <div className="absolute left-0 top-0 h-full w-1/6 z-40 bg-gradient-to-r from-white/70 via-slate-100/50 to-transparent pointer-events-none" />
      <div className="absolute right-0 top-0 h-full w-1/6 z-40 bg-gradient-to-l from-white/70 via-slate-100/50 to-transparent pointer-events-none" />
      <div className="absolute top-0 left-0 w-full h-[32%] z-40 bg-gradient-to-b from-white via-white/85 to-transparent pointer-events-none" />

      <p className="absolute top-14 z-50 text-7xl font-didone tracking-wide text-litratoblack drop-shadow-[0_6px_18px_rgba(0,0,0,0.15)]">
        Events
      </p>

      {images.map((image, index) => {
        const pos = positions[positionIndexes[index]] ?? 'hidden'
        const isCenter = pos === 'center'
        return (
          <motion.img
            key={index}
            src={image.src}
            alt={`image ${index}`}
            className="rounded-[12px] object-cover hover:cursor-pointer hover:scale-105 duration-500"
            initial="center"
            animate={pos}
            variants={imageVariants}
            transition={{ duration: 0.25 }}
            style={{
              width: isCenter ? '24rem' : '16rem',
              maxWidth: '80vw',
              height: isCenter ? '30rem' : '20rem',
              position: 'absolute',
            }}
          />
        )
      })}

      <div className="absolute bottom-10 left-1/2 -translate-x-1/2 z-50 flex items-center gap-6 rounded-full bg-white/90 px-6 py-3 shadow-lg backdrop-blur">
        <button
          onClick={handlePrev}
          className="size-10 flex items-center justify-center rounded-full bg-transparent text-litratoblack transition hover:bg-litratoblack/10"
        >
          <IoIosArrowRoundBack size={60} />
        </button>

        <div className="flex gap-3 hover:cursor-pointer">
          {images.map((_, index) => (
            <div
              key={index}
              onClick={() => setCenterIndex(index)}
              className={`size-[14px] rounded-full border border-litratoblack/40 transition ${
                index === centerIndex
                  ? 'bg-litratored shadow-sm shadow-litratored/60'
                  : 'bg-white/80 hover:bg-litratored/50'
              }`}
            />
          ))}
        </div>

        <button
          onClick={handleNext}
          className="size-10 flex items-center justify-center rounded-full bg-transparent text-litratoblack transition hover:bg-litratoblack/10"
        >
          <IoIosArrowRoundForward size={60} />
        </button>
      </div>
    </div>
  )
}

export default ImageSlider
