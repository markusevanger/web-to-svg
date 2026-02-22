'use client'

import {useRef, useState, useCallback, useEffect} from 'react'
import LucideIcon from '@/app/components/LucideIcon'

type DemoButtonProps = {
  label?: string
  icon?: string
  iconPosition?: 'left' | 'right'
  variant?: 'primary' | 'secondary'
}

export default function DemoButton({label, icon, iconPosition = 'right', variant = 'primary'}: DemoButtonProps) {
  const pickerRef = useRef<any>(null)
  const [active, setActive] = useState(false)

  const handleToggle = useCallback(async () => {
    if (active && pickerRef.current) {
      pickerRef.current.deactivate()
      pickerRef.current = null
      setActive(false)
      return
    }

    // Dynamic import keeps the bundle out of initial page load and avoids SSR issues
    const {Picker, createWebAdapter} = await import('@web-to-svg/engine')
    const adapter = createWebAdapter()
    const picker = new Picker({
      adapter,
      onCleanup: () => {
        pickerRef.current = null
        setActive(false)
      },
    })
    pickerRef.current = picker
    picker.activate()
    setActive(true)
  }, [active])

  // Cleanup on unmount
  useEffect(() => {
    return () => pickerRef.current?.deactivate()
  }, [])

  return (
    <button
      onClick={handleToggle}
      className={`inline-flex items-center gap-2 text-sm whitespace-nowrap rounded-full px-6 py-3 transition-colors duration-200 ${
        active
          ? 'bg-gray-800 text-white hover:bg-gray-700 font-bold'
          : variant === 'primary'
            ? 'bg-primary text-black font-bold hover:bg-primary-dark'
            : 'border border-primary text-black font-normal hover:bg-primary/10'
      }`}
    >
      {icon && iconPosition === 'left' && <LucideIcon name={icon} className="w-5 h-5" />}
      <span>{active ? 'Stop Demo' : (label || 'Try Demo')}</span>
      {icon && iconPosition === 'right' && <LucideIcon name={icon} className="w-5 h-5" />}
    </button>
  )
}
