"use client";
import { useState } from "react";
import { motion } from "framer-motion";
import React from "react";
import hanz from "../public/Images/hanz.png";
import litratobg from "../public/Images/litratobg.jpg";
import gallery1 from "../public/Images/gallery1.jpg";
import Gallery4 from "../public/Images/Gallery4.jpg";
import Gallery5 from "../public/Images/Gallery5.jpg";
import { IoIosArrowRoundForward } from "react-icons/io";
import { IoIosArrowRoundBack } from "react-icons/io";
import { Antic_Didone } from "next/font/google";

const anticDidone = Antic_Didone({
  subsets: ["latin"],
  weight: "400",
});
const ImageSlider = () => {
  const images = [hanz, litratobg, gallery1, Gallery4, Gallery5];
  const positions = ["center", "left1", "left", "right", "right1"];
  const totalImages = images.length;

  const [centerIndex, setCenterIndex] = useState(0);

  const getPositionIndexes = () =>
    Array.from(
      { length: totalImages },
      (_, i) => (i - centerIndex + totalImages) % totalImages
    );

  const positionIndexes = getPositionIndexes();

  const imageVariants = {
    center: { x: "0%", scale: 1, zIndex: 5 },
    left1: { x: "-50%", scale: 0.7, zIndex: 2 },
    left: { x: "-90%", scale: 0.5, zIndex: 1 },
    right: { x: "90%", scale: 0.5, zIndex: 1 },
    right1: { x: "50%", scale: 0.7, zIndex: 2 },
    hidden: { scale: 0, opacity: 0, zIndex: 0 },
  };

  const handlePrev = () => {
    setCenterIndex((prev) => (prev - 1 + totalImages) % totalImages);
  };

  const handleNext = () => {
    setCenterIndex((prev) => (prev + 1) % totalImages);
  };

  return (
    <div className="relative flex items-center flex-col select-none justify-center h-[90vh] overflow-hidden bg-white">
      <div className="absolute left-0 top-0 h-full w-1/6 z-40 bg-gradient-to-r from-white/70 via-slate-100/50 to-transparent pointer-events-none" />
      <div className="absolute right-0 top-0 h-full w-1/6 z-40 bg-gradient-to-l from-white/70 via-slate-100/50 to-transparent pointer-events-none" />

      <p className="text-[98px] absolute top-[5%] font-didone">Events</p>

      {images.map((image, index) => {
        const pos = positions[positionIndexes[index]] ?? "hidden";
        return (
          <motion.img
            key={index}
            src={image.src}
            alt={`image ${index}`}
            className="rounded-[12px] hover:cursor-pointer hover:scale-105 duration-500"
            initial="center"
            animate={pos}
            variants={imageVariants}
            transition={{ duration: 0.05 }}
            style={{ width: "40%", height: "50%", position: "absolute" }}
          />
        );
      })}

      <div className="absolute bottom-30 left-1/2 -translate-x-1/2 z-50 flex items-center gap-6">
        <button
          onClick={handlePrev}
          className="text-2xl text-litratoblack rounded-full size-8 flex items-center justify-center transition"
        >
          <IoIosArrowRoundBack size={60} />
        </button>

        <div className="flex gap-3 hover:cursor-pointer">
          {images.map((_, index) => (
            <div
              key={index}
              onClick={() => setCenterIndex(index)}
              className={`size-[12px] rounded-full ${
                index === centerIndex ? "bg-litratoblack" : "bg-gray-300"
              }`}
            />
          ))}
        </div>

        <button
          onClick={handleNext}
          className="text-2xl text-litratoblack rounded-full size-8 flex items-center justify-center transition"
        >
          <IoIosArrowRoundForward size={60} />
        </button>
      </div>
    </div>
  );
};

export default ImageSlider;
