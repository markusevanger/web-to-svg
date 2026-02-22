import type {Metadata} from 'next'

import Hero from '@/app/components/Hero'

export const metadata: Metadata = {
  title: 'Web to SVG',
  description: 'Click any element on a webpage and export it as a clean SVG or PNG file.',
}

export default function Page() {
  return (
    <>
      <Hero />
      <div className="flex flex-col items-center gap-4 pb-24">
        <span className="inline-block px-4 py-2 rounded-full border border-gray-200 text-sm text-gray-500">
          Coming soon
        </span>
      </div>
    </>
  )
}
