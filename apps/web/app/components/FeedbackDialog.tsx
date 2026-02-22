'use client'

import {useState, useCallback} from 'react'

import LucideIcon from '@/app/components/LucideIcon'
import FeedbackForm from '@/app/components/FeedbackForm'

export default function FeedbackDialog() {
  const [open, setOpen] = useState(false)

  const toggle = useCallback(() => setOpen((o) => !o), [])
  const close = useCallback(() => setOpen(false), [])

  return (
    <>
      <button
        onClick={toggle}
        aria-label="Send feedback"
        className="fixed bottom-6 right-6 z-50 bg-primary text-black font-bold rounded-full px-5 py-3 text-sm shadow-lg hover:bg-primary-dark transition-colors duration-200 flex items-center gap-2"
      >
        <LucideIcon name="message-square-plus" className="w-4 h-4" />
        <span className="hidden sm:inline">Feedback</span>
      </button>

      {open && (
        <>
          <div
            className="fixed inset-0 z-50 bg-black/30 backdrop-blur-sm"
            onClick={close}
          />
          <div className="fixed bottom-20 right-6 z-50 w-[calc(100vw-3rem)] max-w-sm bg-white rounded-2xl shadow-xl p-6 border border-gray-100">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold tracking-tight">Send us feedback</h3>
              <button
                onClick={close}
                className="text-gray-400 hover:text-black transition-colors"
              >
                <LucideIcon name="x" className="w-4 h-4" />
              </button>
            </div>
            <FeedbackForm onSuccess={close} />
          </div>
        </>
      )}
    </>
  )
}
