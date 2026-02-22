'use server'

import {draftMode} from 'next/headers'

import {writeClient} from '@/sanity/lib/writeClient'

export async function disableDraftMode() {
  'use server'
  await Promise.allSettled([
    (await draftMode()).disable(),
    // Simulate a delay to show the loading state
    new Promise((resolve) => setTimeout(resolve, 1000)),
  ])
}

type FeedbackResult = {success: true} | {success: false; error: string}

async function verifyTurnstile(token: string): Promise<boolean> {
  const secret = process.env.TURNSTILE_SECRET_KEY
  if (!secret) return true // Skip verification if not configured

  const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
    method: 'POST',
    headers: {'Content-Type': 'application/x-www-form-urlencoded'},
    body: new URLSearchParams({secret, response: token}),
  })
  const data = await res.json()
  return data.success === true
}

export async function submitFeedback(formData: FormData): Promise<FeedbackResult> {
  const turnstileToken = formData.get('turnstileToken') as string | null
  if (process.env.TURNSTILE_SECRET_KEY) {
    if (!turnstileToken || !(await verifyTurnstile(turnstileToken))) {
      return {success: false, error: 'Verification failed. Please try again.'}
    }
  }

  const name = formData.get('name') as string | null
  const email = formData.get('email') as string | null
  const message = formData.get('message') as string | null
  const feedbackType = formData.get('feedbackType') as string | null
  const screenshot = formData.get('screenshot') as File | null

  if (!message || message.trim().length < 10) {
    return {success: false, error: 'Message must be at least 10 characters.'}
  }

  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return {success: false, error: 'Invalid email address.'}
  }

  const validTypes = ['general', 'bug', 'feature']
  const type = validTypes.includes(feedbackType ?? '') ? feedbackType : 'general'

  try {
    let imageAsset: {_type: 'image'; asset: {_type: 'reference'; _ref: string}} | undefined

    if (screenshot && screenshot.size > 0) {
      if (screenshot.size > 5 * 1024 * 1024) {
        return {success: false, error: 'Image must be under 5 MB.'}
      }

      const buffer = Buffer.from(await screenshot.arrayBuffer())
      const asset = await writeClient.assets.upload('image', buffer, {
        filename: screenshot.name,
        contentType: screenshot.type,
      })

      imageAsset = {
        _type: 'image',
        asset: {_type: 'reference', _ref: asset._id},
      }
    }

    await writeClient.create({
      _type: 'feedback',
      name: name?.trim() || undefined,
      email: email?.trim() || undefined,
      message: message.trim(),
      feedbackType: type,
      screenshot: imageAsset,
      status: 'new',
      createdAt: new Date().toISOString(),
    })

    return {success: true}
  } catch (err) {
    console.error('Feedback submission failed:', err)
    return {success: false, error: 'Something went wrong. Please try again.'}
  }
}
