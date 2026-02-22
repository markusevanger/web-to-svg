'use client'

import {useRef, useState, useCallback} from 'react'
import {useFormStatus} from 'react-dom'
import {toast} from 'sonner'
import {Turnstile, type TurnstileInstance} from '@marsidev/react-turnstile'

import LucideIcon from '@/app/components/LucideIcon'
import {submitFeedback} from '@/app/actions'

function SubmitButton() {
  const {pending} = useFormStatus()
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full bg-primary text-black font-bold rounded-full px-6 py-3 text-sm hover:bg-primary-dark transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
    >
      {pending ? 'Sending...' : 'Send Feedback'}
    </button>
  )
}

const FEEDBACK_TYPES = [
  {value: 'general', label: 'General'},
  {value: 'bug', label: 'Bug'},
  {value: 'feature', label: 'Feature'},
] as const

export default function FeedbackForm({onSuccess}: {onSuccess?: () => void}) {
  const formRef = useRef<HTMLFormElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const turnstileRef = useRef<TurnstileInstance>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null)

  const handleImageChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image must be under 5 MB')
      e.target.value = ''
      return
    }
    setImagePreview(URL.createObjectURL(file))
  }, [])

  const removeImage = useCallback(() => {
    setImagePreview(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }, [])

  async function handleSubmit(formData: FormData) {
    if (!turnstileToken) {
      toast.error('Please complete the verification.')
      return
    }
    formData.set('turnstileToken', turnstileToken)

    const result = await submitFeedback(formData)
    if (result.success) {
      toast.success('Thanks for your feedback!')
      formRef.current?.reset()
      setImagePreview(null)
      setTurnstileToken(null)
      turnstileRef.current?.reset()
      onSuccess?.()
    } else {
      toast.error(result.error)
      turnstileRef.current?.reset()
      setTurnstileToken(null)
    }
  }

  return (
    <form ref={formRef} action={handleSubmit} className="flex flex-col gap-3">
      <fieldset className="flex gap-2">
        {FEEDBACK_TYPES.map((type) => (
          <label key={type.value} className="flex-1">
            <input
              type="radio"
              name="feedbackType"
              value={type.value}
              defaultChecked={type.value === 'general'}
              className="peer sr-only"
            />
            <span className="block text-center text-xs py-2 px-3 rounded-full border border-gray-200 cursor-pointer transition-colors duration-200 peer-checked:bg-primary peer-checked:border-primary peer-checked:text-black hover:border-gray-400">
              {type.label}
            </span>
          </label>
        ))}
      </fieldset>

      <input
        type="text"
        name="name"
        placeholder="Name (optional)"
        className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary/50 placeholder:text-gray-400"
      />

      <input
        type="email"
        name="email"
        placeholder="Email (optional)"
        className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary/50 placeholder:text-gray-400"
      />

      <textarea
        name="message"
        placeholder="Your feedback..."
        rows={4}
        required
        minLength={10}
        className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm bg-white resize-none focus:outline-none focus:ring-2 focus:ring-primary/50 placeholder:text-gray-400"
      />

      <div>
        {imagePreview ? (
          <div className="relative inline-block">
            <img
              src={imagePreview}
              alt="Preview"
              className="rounded-xl max-h-32 object-cover"
            />
            <button
              type="button"
              onClick={removeImage}
              className="absolute -top-2 -right-2 w-6 h-6 bg-gray-900 text-white rounded-full flex items-center justify-center"
            >
              <LucideIcon name="x" className="w-3 h-3" />
            </button>
          </div>
        ) : (
          <label className="block cursor-pointer">
            <span className="flex items-center justify-center gap-2 text-xs text-gray-400 rounded-xl border border-dashed border-gray-300 px-4 py-3 hover:border-gray-400 hover:text-gray-500 transition-colors">
              <LucideIcon name="image-plus" className="w-4 h-4" />
              Attach a screenshot (max 5 MB)
            </span>
            <input
              ref={fileInputRef}
              type="file"
              name="screenshot"
              accept="image/*"
              className="sr-only"
              onChange={handleImageChange}
            />
          </label>
        )}
      </div>

      {process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY && (
        <Turnstile
          ref={turnstileRef}
          siteKey={process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY}
          onSuccess={setTurnstileToken}
          onExpire={() => setTurnstileToken(null)}
        />
      )}

      <SubmitButton />
    </form>
  )
}
