import {PortableText} from '@portabletext/react'
import {PortableTextBlock} from 'next-sanity'
import {stegaClean} from '@sanity/client/stega'

import LucideIcon from '@/app/components/LucideIcon'
import Image from '@/app/components/SanityImage'
import {ExtractPageBuilderType} from '@/sanity/lib/types'

const iconColors = [
  'var(--color-primary)',
  'var(--color-accent-yellow)',
  'var(--color-blue)',
  'var(--color-accent-pink)',
]

type BlocksProps = {
  block: ExtractPageBuilderType<'blocks'>
  index: number
  pageType: string
  pageId: string
}

const excerptComponents = {
  block: {
    normal: ({children}: {children?: React.ReactNode}) => (
      <p className="text-gray-600 text-sm md:text-base leading-relaxed">{children}</p>
    ),
  },
  marks: {
    strong: ({children}: {children?: React.ReactNode}) => (
      <strong className="font-bold">{children}</strong>
    ),
    em: ({children}: {children?: React.ReactNode}) => <em className="italic">{children}</em>,
  },
}

export default function Blocks({block}: BlocksProps) {
  const {heading, items} = block

  return (
    <section className="px-6 lg:px-28 py-16">
      {heading && (
        <h2 className="text-2xl md:text-3xl font-bold mb-12 text-center">{heading}</h2>
      )}

      {items?.length ? (
        <div className="grid sm:grid-cols-2 gap-8 mx-auto max-w-2xl">
          {items.map((item, i) => {
            const iconName = stegaClean(item.icon)
            const mediaType = stegaClean(item.mediaType)
            const isImage = mediaType === 'image'
            const isLastOdd = items.length % 2 === 1 && i === items.length - 1

            return (
              <div
                key={item._key}
                className={`flex flex-col items-center text-center p-8 rounded-xl border border-gray-100 bg-white aspect-square justify-center ${isLastOdd ? 'sm:col-span-2 sm:aspect-auto' : ''}`}
              >
                {isImage && item.image?.asset?._ref ? (
                  <div className="mb-6 aspect-square w-full overflow-hidden rounded-lg">
                    <Image
                      id={item.image.asset._ref}
                      alt={item.title || ''}
                      width={400}
                      crop={item.image.crop}
                      mode="cover"
                      className="size-full object-cover"
                    />
                  </div>
                ) : iconName ? (
                  <div className="mb-6" style={{color: iconColors[i % iconColors.length]}}>
                    <LucideIcon name={iconName} size={48} strokeWidth={1.5} />
                  </div>
                ) : null}

                {item.title && (
                  <h3 className="text-lg font-bold mb-3">{item.title}</h3>
                )}

                {item.excerpt && (
                  <PortableText
                    value={item.excerpt as PortableTextBlock[]}
                    components={excerptComponents}
                  />
                )}
              </div>
            )
          })}
        </div>
      ) : null}
    </section>
  )
}
