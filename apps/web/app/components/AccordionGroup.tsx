'use client'

import {useState} from 'react'
import {type PortableTextBlock} from 'next-sanity'
import PortableText from '@/app/components/PortableText'

type AccordionItem = {
  _key: string
  title?: string
  content?: PortableTextBlock[]
}

type AccordionGroupProps = {
  items?: AccordionItem[]
}

function AccordionItem({item}: {item: AccordionItem}) {
  const [open, setOpen] = useState(false)

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="flex w-full cursor-pointer items-center justify-between py-4 font-medium select-none text-left"
      >
        {item.title}
        <svg
          className={`h-5 w-5 shrink-0 transition-transform duration-250 ${open ? 'rotate-180' : ''}`}
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={2}
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
        </svg>
      </button>
      <div
        className={`grid transition-[grid-template-rows] duration-250 ease-in-out ${open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}
      >
        <div className="overflow-hidden">
          {item.content?.length ? (
            <div className="pb-4">
              <PortableText value={item.content} />
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}

export default function AccordionGroup({items}: AccordionGroupProps) {
  if (!items?.length) return null

  return (
    <div className="divide-y divide-gray-200 border-y border-gray-200">
      {items.map((item) => (
        <AccordionItem key={item._key} item={item} />
      ))}
    </div>
  )
}
