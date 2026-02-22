import type {Metadata} from 'next'

import FeedbackForm from '@/app/components/FeedbackForm'

export const metadata: Metadata = {
  title: 'Feedback',
  description: 'Send us feedback, report a bug, or request a feature.',
}

export default function FeedbackPage() {
  return (
    <div className="my-12 lg:my-24 min-h-screen">
      <div className="container">
        <div className="pb-6 border-b border-gray-100">
          <div className="max-w-3xl">
            <h1 className="text-4xl text-black sm:text-5xl lg:text-7xl">Feedback</h1>
            <p className="mt-4 text-base lg:text-lg leading-relaxed text-black uppercase font-light">
              Help us improve Web to SVG. Report a bug, request a feature, or just say hi.
            </p>
          </div>
        </div>
        <div className="mt-12 max-w-lg">
          <FeedbackForm />
        </div>
      </div>
    </div>
  )
}
