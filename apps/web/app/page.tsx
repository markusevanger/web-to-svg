import type {Metadata} from 'next'

import Hero from '@/app/components/Hero'
import PageBuilderPage from '@/app/components/PageBuilder'
import {sanityFetch} from '@/sanity/lib/live'
import {frontpageQuery, getPageQuery} from '@/sanity/lib/queries'
import {GetPageQueryResult} from '@/sanity.types'

export const metadata: Metadata = {
  title: 'Web to SVG',
  description: 'Click any element on a webpage and export it as a clean SVG or PNG file.',
}

export default async function Page() {
  const {data: frontpageSlug} = await sanityFetch({query: frontpageQuery})

  const {data: page} = frontpageSlug
    ? await sanityFetch({query: getPageQuery, params: {slug: frontpageSlug}})
    : {data: null}

  return (
    <>
      <Hero />
      {page && <PageBuilderPage page={page as GetPageQueryResult} />}
    </>
  )
}
