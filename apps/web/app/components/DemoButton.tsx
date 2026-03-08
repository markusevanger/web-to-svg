'use client'

declare global {
  interface Window {
    umami?: { track: (event: string, data?: Record<string, unknown>) => void }
  }
}

import {useRef, useState, useCallback, useEffect} from 'react'
import LucideIcon from '@/app/components/LucideIcon'

type DemoButtonProps = {
  label?: string
  icon?: string
  iconPosition?: 'left' | 'right'
  variant?: 'primary' | 'secondary'
}

export default function DemoButton({label, icon, iconPosition = 'right', variant = 'primary'}: DemoButtonProps) {
  const pickerRef = useRef<{deactivate: () => void} | null>(null)
  const [active, setActive] = useState(false)

  const deactivate = useCallback(() => {
    pickerRef.current?.deactivate()
    pickerRef.current = null
    setActive(false)
  }, [])

  const handleActivate = useCallback(async () => {
    if (active) return

    const {Picker, createWebAdapter} = await import('@web-to-svg/engine')
    const adapter = createWebAdapter()
    const picker = new Picker({
      adapter,
      onCleanup: () => {
        pickerRef.current = null
        setActive(false)
      },
      onEvent: (name: string, detail?: Record<string, unknown>) => {
        window.umami?.track(`demo-${name}`, detail)
      },
    })
    pickerRef.current = picker
    picker.activate()
    setActive(true)
    window.umami?.track('demo-start')
  }, [active])

  // Escape key to close
  useEffect(() => {
    if (!active) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') deactivate()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [active, deactivate])

  // Cleanup on unmount
  useEffect(() => {
    return () => pickerRef.current?.deactivate()
  }, [])

  return (
    <>
      <button
        onClick={handleActivate}
        disabled={active}
        className={`cursor-pointer inline-flex items-center gap-2 text-sm whitespace-nowrap rounded-full px-6 py-3 transition-colors duration-200 ${
          variant === 'primary'
            ? 'bg-primary text-black font-bold hover:bg-primary-dark'
            : 'border border-primary text-black font-normal hover:bg-primary/10'
        } ${active ? 'opacity-50 pointer-events-none' : ''}`}
      >
        {icon && iconPosition === 'left' && <LucideIcon name={icon} className="w-5 h-5" />}
        <span>{label || 'Try Demo'}</span>
        {icon && iconPosition === 'right' && <LucideIcon name={icon} className="w-5 h-5" />}
      </button>

      {/* Screen border + escape hint overlay */}
      {active && <DemoBorderOverlay onClose={deactivate} />}
    </>
  )
}

function DemoBorderOverlay({onClose}: {onClose: () => void}) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    // Trigger enter animation on next frame
    requestAnimationFrame(() => setVisible(true))
  }, [])

  return (
    <div
      className="fixed inset-0 z-[9999] pointer-events-none transition-opacity duration-300"
      style={{opacity: visible ? 1 : 0}}
    >
      {/* Border */}
      <div className="absolute inset-0 border-4 border-primary rounded-sm animate-border-glow" />

      {/* Escape hint */}
      <div className="absolute top-8 left-1/2 -translate-x-1/2 pointer-events-auto">
        <button
          onClick={onClose}
          className="cursor-pointer flex items-center gap-2 bg-black/80 backdrop-blur-sm text-white text-sm px-4 py-2 rounded-full shadow-lg hover:bg-black/90 transition-colors"
        >
          Press <kbd className="px-1.5 py-0.5 bg-white/20 rounded text-xs font-mono">ESC</kbd> to
          close
        </button>
      </div>
    </div>
  )
}
