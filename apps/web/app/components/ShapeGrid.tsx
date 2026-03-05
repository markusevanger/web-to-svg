'use client'

import {useState, useCallback} from 'react'
import {motion} from 'motion/react'

type ShapeType = 'circle' | 'triangle' | 'square' | 'star'

const shapeTypes: ShapeType[] = ['circle', 'triangle', 'square', 'star']

const colors = [
  'var(--color-primary)',
  'var(--color-blue)',
  'var(--color-accent-yellow)',
  'var(--color-accent-pink)',
]

const shapes: Record<ShapeType, React.ReactNode> = {
  circle: <circle cx="30" cy="30" r="30" />,
  triangle: <polygon points="30,0 60,52 0,52" transform="translate(0,4)" />,
  square: <rect x="0" y="0" width="60" height="60" rx="4" />,
  star: (
    <polygon points="30,0 36.9,20.6 58.5,20.6 41,34.4 47.6,55.9 30,42.7 12.4,55.9 19,34.4 1.5,20.6 23.1,20.6" transform="translate(0,2) scale(1,1.035)" />
  ),
}

// Seeded pseudo-random number generator for deterministic placement
function seededRandom(seed: number) {
  let s = seed
  return () => {
    s = (s * 16807 + 0) % 2147483647
    return (s - 1) / 2147483646
  }
}

type ShapeGridProps = {
  count: number
  seed?: number
}

export default function ShapeGrid({count, seed = 42}: ShapeGridProps) {
  const rand = seededRandom(seed)

  const placed: {x: number; y: number; r: number}[] = []
  const items: {
    shape: ShapeType; color: string; size: number
    x: number; y: number; rotation: number
    delay: number; floatDuration: number; floatAmount: number
  }[] = []

  for (let i = 0; i < count; i++) {
    const shape = shapeTypes[i % shapeTypes.length]
    const color = colors[i % colors.length]
    const size = 70 + rand() * 60 // 70–130px
    const sizePercent = size / 4 // approximate radius in % units
    const rotation = Math.round(rand() * 360 - 180)
    const delay = rand() * 0.4
    const floatDuration = 2.5 + rand() * 2
    const floatAmount = 6 + rand() * 10

    let x = 0, y = 0
    let attempts = 0
    do {
      x = 15 + rand() * 70 // 15–85%
      y = 15 + rand() * 70
      attempts++
    } while (
      attempts < 50 &&
      placed.some((p) => {
        const dx = p.x - x
        const dy = p.y - y
        const minDist = (p.r + sizePercent) * 0.5
        return dx * dx + dy * dy < minDist * minDist
      })
    )

    placed.push({x, y, r: sizePercent})
    items.push({shape, color, size, x, y, rotation, delay, floatDuration, floatAmount})
  }

  return (
    <div className="relative aspect-square w-full flex items-center justify-center">
      {items.map((item, i) => (
        <SpinnableShape key={i} item={item} />
      ))}
    </div>
  )
}

type ShapeItem = {
  shape: ShapeType; color: string; size: number
  x: number; y: number; rotation: number
  delay: number; floatDuration: number; floatAmount: number
}

function SpinnableShape({item}: {item: ShapeItem}) {
  const [spins, setSpins] = useState(0)

  const handleClick = useCallback(() => {
    setSpins((s) => s + 1)
  }, [])

  return (
    <motion.div
      className="absolute -translate-x-1/2 -translate-y-1/2 cursor-pointer"
      style={{
        width: item.size,
        height: item.size,
        left: `${item.x}%`,
        top: `${item.y}%`,
      }}
      initial={{scale: 0, opacity: 0}}
      animate={{
        scale: 1,
        opacity: 1,
        y: [0, -item.floatAmount, 0],
      }}
      transition={{
        type: 'spring',
        stiffness: 260,
        damping: 20,
        delay: item.delay,
        y: {
          duration: item.floatDuration,
          repeat: Infinity,
          ease: 'easeInOut',
          delay: item.delay,
        },
      }}
      onClick={handleClick}
      whileHover={{scale: 1.15}}
    >
      <motion.svg
        viewBox="0 0 60 60"
        fill={item.color}
        aria-hidden="true"
        className="w-full h-full"
        animate={{rotate: item.rotation + spins * 180}}
        transition={{type: 'spring', stiffness: 80, damping: 20}}
      >
        {shapes[item.shape]}
      </motion.svg>
    </motion.div>
  )
}
