import {PortableText} from '@portabletext/react'
import {PortableTextBlock} from 'next-sanity'

import Image from '@/app/components/SanityImage'
import {stegaClean} from '@sanity/client/stega'
import {ExtractPageBuilderType} from '@/sanity/lib/types'

type StepsProps = {
  block: ExtractPageBuilderType<'steps'>
  index: number
  pageType: string
  pageId: string
}

const stepPortableTextComponents = {
  block: {
    normal: ({children}: {children?: React.ReactNode}) => (
      <span className="text-lg md:text-2xl">{children}</span>
    ),
  },
  marks: {
    strong: ({children}: {children?: React.ReactNode}) => (
      <strong className="font-bold">{children}</strong>
    ),
    em: ({children}: {children?: React.ReactNode}) => (
      <em className="italic">{children}</em>
    ),
    highlight: ({
      children,
      value,
    }: {
      children?: React.ReactNode
      value?: {color?: string}
    }) => (
      <span
        className="px-1.5 py-0.5 rounded-lg"
        style={{backgroundColor: value?.color || '#f5b700'}}
      >
        {children}
      </span>
    ),
  },
}

export default function Steps({block}: StepsProps) {
  const {heading, steps, image, contentAlignment} = block
  const isImageFirst = stegaClean(contentAlignment) === 'imageFirst'

  return (
    <section className="px-6 lg:px-28 py-16">
      <div className="grid lg:grid-cols-2 gap-12 lg:gap-24 items-center">
        <div className={isImageFirst && image ? 'lg:order-2' : ''}>
          {heading && <h2 className="text-2xl md:text-3xl font-bold mb-8">{heading}</h2>}

          {steps?.length ? (
            <ol className="space-y-6">
              {steps.map((step, i) => (
                <li key={step._key} className="flex gap-4">
                  <span className="text-lg md:text-2xl font-bold shrink-0">{i + 1}.</span>
                  <div>
                    <PortableText
                      value={step.text as PortableTextBlock[]}
                      components={stepPortableTextComponents}
                    />
                  </div>
                </li>
              ))}
            </ol>
          ) : null}
        </div>

        <div className={isImageFirst && image ? 'lg:order-1' : ''}>
          {image?.asset?._ref ? (
            <Image
              id={image.asset._ref}
              alt="Steps illustration"
              width={704}
              crop={image.crop}
              mode="cover"
              className="rounded-xl"
            />
          ) : (
            <div className="bg-placeholder rounded-xl aspect-video" />
          )}
        </div>
      </div>
    </section>
  )
}
