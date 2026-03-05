import {type PortableTextBlock} from 'next-sanity'

import PortableText from '@/app/components/PortableText'
import Image from '@/app/components/SanityImage'
import ShapeGrid from '@/app/components/ShapeGrid'
import {stegaClean} from '@sanity/client/stega'
import {ExtractPageBuilderType} from '@/sanity/lib/types'

type SplitSectionProps = {
  block: ExtractPageBuilderType<'splitSection'>
  index: number
  pageId: string
  pageType: string
}

export default function SplitSection({block, index}: SplitSectionProps) {
  const {heading, subheading, content, mediaType, image, video, videoUrl, contentAlignment} = block
  const cleanMediaType = stegaClean(mediaType)
  const isMediaFirst = stegaClean(contentAlignment) === 'imageFirst'

  return (
    <section className="px-6 lg:px-28 py-16">
      <div className="grid lg:grid-cols-2 gap-12 lg:gap-24 items-center">
        <div className={isMediaFirst ? 'lg:order-2' : ''}>
          {heading && (
            <h2 className="text-2xl md:text-3xl lg:text-4xl">{heading}</h2>
          )}
          {subheading && (
            <span className="block mt-4 text-lg uppercase font-light text-black">
              {subheading}
            </span>
          )}
          {content?.length ? (
            <div className="mt-6">
              <PortableText value={content as PortableTextBlock[]} />
            </div>
          ) : null}
        </div>

        <div
          className={`${isMediaFirst ? 'lg:order-1' : ''} overflow-hidden`}
        >
          {cleanMediaType === 'shapes' ? (
            <ShapeGrid
              count={(block as {shapeCount?: number}).shapeCount || 6}
              seed={index * 137 + 42}
            />
          ) : cleanMediaType === 'video' ? (
            videoUrl ? (
              <iframe
                src={videoUrl}
                className="w-full aspect-video rounded-xl"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            ) : video?.asset?._ref ? (
              <video
                autoPlay
                loop
                muted
                playsInline
                className="w-full rounded-xl object-cover"
              >
                <source src={`https://cdn.sanity.io/files/wdqtle79/production/${video.asset._ref.replace('file-', '').replace('-', '.')}`} />
              </video>
            ) : (
              <div className="bg-placeholder rounded-xl aspect-video" />
            )
          ) : image?.asset?._ref ? (
            <div className="aspect-[3/2] w-full overflow-hidden rounded-xl">
              <Image
                id={image.asset._ref}
                alt={heading || 'Section image'}
                width={1200}
                crop={image.crop}
                mode="cover"
                className="size-full object-cover"
              />
            </div>
          ) : (
            <div className="bg-placeholder rounded-xl aspect-[3/2] w-full" />
          )}
        </div>
      </div>
    </section>
  )
}
