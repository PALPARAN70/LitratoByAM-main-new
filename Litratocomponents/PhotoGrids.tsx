"use client";
import LitratoByAMphotogrids1 from "../public/Images/LitratoByAMphotogrids1.jpg";
import LitratoByAMphotogrids2 from "../public/Images/LitratoByAMphotogrids2.jpg";
import LitratoByAMphotogrids3 from "../public/Images/LitratoByAMphotogrids3.jpg";
import LitratoByAMphotogrids4 from "../public/Images/LitratoByAMphotogrids4.jpg";
import LitratoByAMphotogrids5 from "../public/Images/LitratoByAMphotogrids5.jpg";
import LitratoByAMphotogrids6 from "../public/Images/LitratoByAMphotogrids6.jpg";
import LitratoByAMphotogrids7 from "../public/Images/LitratoByAMphotogrids7.jpg";
import LitratoByAMphotogrids8 from "../public/Images/LitratoByAMphotogrids8.jpg";
import Image from "next/image";
import { useState } from "react";

type PhotoGridsProps = {
  value?: number[];
  onChange?: (selected: number[]) => void;
  max?: number; // default 2
};

export default function PhotoGrids({
  value,
  onChange,
  max = 2,
}: PhotoGridsProps) {
  const images = [
    LitratoByAMphotogrids1,
    LitratoByAMphotogrids2,
    LitratoByAMphotogrids3,
    LitratoByAMphotogrids4,
    LitratoByAMphotogrids5,
    LitratoByAMphotogrids6,
    LitratoByAMphotogrids7,
    LitratoByAMphotogrids8,
  ];
  const baseCardClass =
    "border p-2 rounded shadow-md hover:shadow-xl transition cursor-pointer";

  // Controlled vs uncontrolled
  const [internal, setInternal] = useState<number[]>([]);
  const selectedIdxs = value ?? internal;
  const atLimit = selectedIdxs.length >= max;

  const toggle = (idx: number) => {
    const next = selectedIdxs.includes(idx)
      ? selectedIdxs.filter((i) => i !== idx)
      : selectedIdxs.length < max
      ? [...selectedIdxs, idx]
      : selectedIdxs;
    if (value !== undefined) {
      onChange?.(next);
    } else {
      setInternal(next);
      onChange?.(next);
    }
  };

  return (
    <div className="grid grid-cols-4 grid-rows-2  gap-4">
      {images.map((src, idx) => {
        const selected = selectedIdxs.includes(idx);
        return (
          <button
            type="button"
            key={idx}
            aria-pressed={selected}
            onClick={() => toggle(idx)}
            className={`${baseCardClass} ${
              selected ? "ring-2 ring-litratored ring-offset-2" : ""
            } ${
              atLimit && !selected ? "opacity-60 cursor-not-allowed" : ""
            } focus-visible:ring-2 focus-visible:ring-litratored  focus:outline-none`}
          >
            <Image
              src={src}
              alt={`Photo Grid ${idx + 1}`}
              className="w-full h-auto rounded-md"
              priority
            />
          </button>
        );
      })}
    </div>
  );
}
