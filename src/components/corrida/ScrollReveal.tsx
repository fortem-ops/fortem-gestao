import { motion, type Variants } from "framer-motion";
import { type ReactNode } from "react";

type Direction = "up" | "down" | "left" | "right";

interface ScrollRevealProps {
  children: ReactNode;
  direction?: Direction;
  delay?: number;
  duration?: number;
  className?: string;
}

const getVariants = (direction: Direction, duration: number): Variants => {
  const offsets: Record<Direction, { x: number; y: number }> = {
    up: { x: 0, y: 40 },
    down: { x: 0, y: -40 },
    left: { x: 40, y: 0 },
    right: { x: -40, y: 0 },
  };
  const { x, y } = offsets[direction];
  return {
    hidden: { opacity: 0, x, y },
    visible: { opacity: 1, x: 0, y: 0, transition: { duration, ease: [0.25, 0.1, 0.25, 1] } },
  };
};

export const ScrollReveal = ({ children, direction = "up", delay = 0, duration = 0.6, className }: ScrollRevealProps) => (
  <motion.div
    variants={getVariants(direction, duration)}
    initial="hidden"
    whileInView="visible"
    viewport={{ once: true, amount: 0.15 }}
    transition={{ delay }}
    className={className}
  >
    {children}
  </motion.div>
);

interface StaggerContainerProps {
  children: ReactNode;
  staggerDelay?: number;
  className?: string;
}

export const StaggerContainer = ({ children, staggerDelay = 0.1, className }: StaggerContainerProps) => (
  <motion.div
    initial="hidden"
    whileInView="visible"
    viewport={{ once: true, amount: 0.15 }}
    transition={{ staggerChildren: staggerDelay }}
    className={className}
  >
    {children}
  </motion.div>
);

export const StaggerItem = ({ children, direction = "up", duration = 0.5, className }: Omit<ScrollRevealProps, "delay">) => (
  <motion.div variants={getVariants(direction, duration)} className={className}>
    {children}
  </motion.div>
);
