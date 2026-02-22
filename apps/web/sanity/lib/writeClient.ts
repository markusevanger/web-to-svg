import 'server-only'

import {createClient} from 'next-sanity'

import {apiVersion, dataset, projectId} from '@/sanity/lib/api'

const writeToken = process.env.SANITY_API_WRITE_TOKEN

if (!writeToken) {
  console.warn('Missing SANITY_API_WRITE_TOKEN — feedback submissions will fail')
}

export const writeClient = createClient({
  projectId,
  dataset,
  apiVersion,
  useCdn: false,
  token: writeToken,
})
