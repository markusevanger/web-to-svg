import type {Metadata} from 'next'

import Hero from '@/app/components/Hero'
import PageBuilderPage from '@/app/components/PageBuilder'
import {sanityFetch} from '@/sanity/lib/live'
import {getPageQuery} from '@/sanity/lib/queries'
import {GetPageQueryResult} from '@/sanity.types'

export const metadata: Metadata = {
  title: 'Web to SVG',
  description: 'Click any element on a webpage and export it as a clean SVG or PNG file.',
}

export default async function Page() {
  const {data: page} = await sanityFetch({
    query: getPageQuery,
    params: {slug: 'home'},
  })

  return (
    <>
      <Hero />
      {page && <PageBuilderPage page={page as GetPageQueryResult} />}
    </>
  )
}
