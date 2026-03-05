import React from 'react'

import Cta from '@/app/components/Cta'
import Info from '@/app/components/InfoSection'
import SplitSection from '@/app/components/SplitSection'
import Steps from '@/app/components/Steps'
import BlocksComponent from '@/app/components/Blocks'
import MediaSection from '@/app/components/MediaSection'
import {dataAttr} from '@/sanity/lib/utils'
import {PageBuilderSection} from '@/sanity/lib/types'

type BlockProps = {
  index: number
  block: PageBuilderSection
  pageId: string
  pageType: string
}

type BlocksType = {
  [key: string]: React.FC<BlockProps>
}

const Blocks = {
  callToAction: Cta,
  infoSection: Info,
  splitSection: SplitSection,
  steps: Steps,
  blocks: BlocksComponent,
  mediaSection: MediaSection,
} as BlocksType

/**
 * Used by the <PageBuilder>, this component renders a the component that matches the block type.
 */
export default function BlockRenderer({block, index, pageId, pageType}: BlockProps) {
  // Block does exist
  if (typeof Blocks[block._type] !== 'undefined') {
    const anchor = 'anchor' in block ? (block as {anchor?: string}).anchor : undefined
    return (
      <div
        key={block._key}
        id={anchor || undefined}
        data-sanity={dataAttr({
          id: pageId,
          type: pageType,
          path: `pageBuilder[_key=="${block._key}"]`,
        }).toString()}
      >
        {React.createElement(Blocks[block._type], {
          key: block._key,
          block: block,
          index: index,
          pageId: pageId,
          pageType: pageType,
        })}
      </div>
    )
  }
  // Block doesn't exist yet
  return React.createElement(
    () => (
      <div className="w-full bg-gray-100 text-center text-gray-500 p-20 rounded">
        A &ldquo;{block._type}&rdquo; block hasn&apos;t been created
      </div>
    ),
    {key: block._key},
  )
}
