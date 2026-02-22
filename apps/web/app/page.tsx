import type {Metadata} from 'next'

import Hero from '@/app/components/Hero'
import PageBuilderPage from '@/app/components/PageBuilder'
import {sanityFetch} from '@/sanity/lib/live'
import {getPageQuery} from '@/sanity/lib/queries'

export async function generateMetadata(): Promise<Metadata> {
  const {data: page} = await sanityFetch({
    query: getPageQuery,
    params: {slug: 'home'},
    stega: false,
  })

  return {
    title: page?.name,
    description: page?.subheading || page?.heading,
  } satisfies Metadata
}

export default async function Page() {
  const {data: page} = await sanityFetch({
    query: getPageQuery,
    params: {slug: 'home'},
  })

  if (!page?._id) {
    return (
      <div className="container py-40 text-center">
        <h1 className="text-3xl font-bold mb-4">No homepage found</h1>
        <p className="text-black">
          Create a page with slug &ldquo;home&rdquo; in Sanity Studio to get started.
        </p>
      </div>
    )
  }

  return (
    <>
      <Hero />
      <PageBuilderPage page={page} />
    </>
  )
}
