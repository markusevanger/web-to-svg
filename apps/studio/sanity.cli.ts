import {defineCliConfig} from 'sanity/cli'

const projectId = process.env.SANITY_STUDIO_PROJECT_ID || 'wdqtle79'
const dataset = process.env.SANITY_STUDIO_DATASET || 'production'

export default defineCliConfig({
  api: {
    projectId,
    dataset,
  },
  studioHost: 'webtosvg',
  deployment: {autoUpdates: true},
  typegen: {
    path: './src/**/*.{ts,tsx,js,jsx}',
    schema: '../../sanity.schema.json',
    generates: './sanity.types.ts',
    overloadClientMethods: true,
  },
})
