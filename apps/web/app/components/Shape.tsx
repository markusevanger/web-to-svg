"use client"

import { useState, useCallback } from "react"
import { motion, type TargetAndTransition, type Transition } from "motion/react"

type ShapeType = 'circle' | 'triangle' | 'square' | 'star'

const colors = {
  primary: 'var(--color-primary)',
  blue: 'var(--color-blue)',
  yellow: 'var(--color-accent-yellow)',
  pink: 'var(--color-accent-pink)',
} as const

type ShapeProps = {
  shape: ShapeType
  color: keyof typeof colors
  size?: string
  rotate?: number
  animate?: { initial?: TargetAndTransition; animate?: TargetAndTransition; transition?: Transition }
}

const shapes: Record<ShapeType, React.ReactNode> = {
  circle: <circle cx="30" cy="30" r="30" />,
  triangle: <polygon points="30,0 60,52 0,52" transform="translate(0,4)" />,
  square: <rect x="0" y="0" width="60" height="60" rx="4" />,
  star: (
    <polygon points="30,0 36.9,20.6 58.5,20.6 41,34.4 47.6,55.9 30,42.7 12.4,55.9 19,34.4 1.5,20.6 23.1,20.6" transform="translate(0,2) scale(1,1.035)" />
  ),
}

export default function Shape({shape, color, size = '0.6em', rotate = 0, animate}: ShapeProps) {
  const [spins, setSpins] = useState(0)
  const handleClick = useCallback(() => setSpins((s) => s + 1), [])

  return (
    <motion.span
      className="inline-block shrink-0 self-center cursor-pointer"
      style={{width: size, height: size}}
      initial={animate?.initial}
      animate={animate?.animate}
      transition={animate?.transition}
      onClick={handleClick}
      whileHover={{scale: 1.15}}
    >
      <motion.svg
        viewBox="0 0 60 60"
        className="w-full h-full"
        fill={colors[color]}
        aria-hidden="true"
        animate={{rotate: (rotate || 0) + spins * 180}}
        transition={{type: 'spring', stiffness: 80, damping: 20}}
      >
        {shapes[shape]}
      </motion.svg>
    </motion.span>
  )
}
