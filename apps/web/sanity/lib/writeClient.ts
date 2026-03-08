import 'server-only'

import {createClient} from 'next-sanity'

import {apiVersion, dataset, projectId} from '@/sanity/lib/api'

const token = process.env.SANITY_API_TOKEN

if (!token) {
  console.warn('Missing SANITY_API_TOKEN — feedback submissions will fail')
}

export const writeClient = createClient({
  projectId,
  dataset,
  apiVersion,
  useCdn: false,
  token,
})
