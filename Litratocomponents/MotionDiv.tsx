"use client";
import { motion } from "framer-motion";
import type { ComponentProps } from "react";

type MotionDivProps = ComponentProps<typeof motion.div> & {
  delay?: number;
};

export default function MotionDiv({
  children,
  delay = 0,
  initial,
  animate,
  exit,
  transition,
  ...rest
}: MotionDivProps) {
  return (
    <motion.div
      initial={initial ?? { opacity: 0, y: 12 }}
      animate={animate ?? { opacity: 1, y: 0 }}
      exit={exit ?? { opacity: 0, y: 12 }}
      transition={transition ?? { duration: 0.3, ease: "easeOut", delay }}
      {...rest}
    >
      {children}
    </motion.div>
  );
}
