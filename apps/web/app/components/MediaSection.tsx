import Image from '@/app/components/SanityImage'
import {stegaClean} from '@sanity/client/stega'
import {ExtractPageBuilderType} from '@/sanity/lib/types'

type MediaSectionProps = {
  block: ExtractPageBuilderType<'mediaSection'>
  index: number
  pageType: string
  pageId: string
}

export default function MediaSection({block}: MediaSectionProps) {
  const {mediaType, image, video, videoUrl, caption} = block

  return (
    <section className="px-6 lg:px-28 py-16">
      <div className="overflow-hidden rounded-xl">
        {stegaClean(mediaType) === 'video' ? (
          videoUrl ? (
            <iframe
              src={videoUrl}
              className="w-full aspect-video"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          ) : video?.asset?._ref ? (
            <video
              autoPlay
              loop
              muted
              playsInline
              className="w-full object-cover"
            >
              <source
                src={`https://cdn.sanity.io/files/wdqtle79/production/${video.asset._ref.replace('file-', '').replace('-', '.')}`}
              />
            </video>
          ) : (
            <div className="bg-placeholder aspect-video" />
          )
        ) : image?.asset?._ref ? (
          <Image
            id={image.asset._ref}
            alt={caption || ''}
            width={1920}
            crop={image.crop}
            mode="cover"
            className="w-full"
          />
        ) : (
          <div className="bg-placeholder aspect-video" />
        )}
      </div>
      {caption && (
        <p className="mt-3 text-center text-sm text-gray-500">{caption}</p>
      )}
    </section>
  )
}
