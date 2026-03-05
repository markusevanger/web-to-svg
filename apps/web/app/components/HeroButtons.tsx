'use client'

import {useEffect, useState} from 'react'
import DemoButton from '@/app/components/DemoButton'
import Button from '@/app/components/Button'
import {DereferencedLink} from '@/sanity/lib/types'

type FallbackButton = {
  buttonText?: string
  link?: DereferencedLink
  variant?: 'primary' | 'secondary'
  icon?: string
  iconPosition?: 'left' | 'right'
}

type HeroButtonsProps = {
  fallbackButton?: FallbackButton
}

function canUseExtension(): boolean {
  if (typeof window === 'undefined') return true
  const ua = navigator.userAgent
  // Chrome (but not Edge, Opera, etc. — though those support Chrome extensions too)
  const isChrome = /Chrome\//.test(ua) && !/Edg\/|OPR\//.test(ua)
  const isDesktop = !/Android|iPhone|iPad|iPod|Mobile/i.test(ua)
  return isChrome && isDesktop
}

export default function HeroButtons({fallbackButton}: HeroButtonsProps) {
  const [supported, setSupported] = useState(true)

  useEffect(() => {
    setSupported(canUseExtension())
  }, [])

  const showFallback = !supported && fallbackButton?.buttonText

  return (
    <div className="flex flex-col sm:flex-row items-center gap-3 justify-center">
      {showFallback ? (
        <Button
          buttonText={fallbackButton.buttonText}
          link={fallbackButton.link}
          variant={fallbackButton.variant}
          icon={fallbackButton.icon}
          iconPosition={fallbackButton.iconPosition}
        />
      ) : (
        <DemoButton label="Try Right Here" variant="primary" />
      )}
      <a
        href="#how-it-works"
        className="cursor-pointer inline-flex items-center gap-2 text-sm whitespace-nowrap border border-primary text-black font-normal rounded-full px-6 py-3 hover:bg-primary/10 transition-colors duration-200"
      >
        How it works
      </a>
    </div>
  )
}
