import Image from 'next/image'
import Link from 'next/link'
import {PortableText, type PortableTextBlock} from 'next-sanity'
import ButtonGroup from '@/app/components/ButtonGroup'
import {settingsQuery} from '@/sanity/lib/queries'
import {sanityFetch} from '@/sanity/lib/live'
import {DereferencedLink} from '@/sanity/lib/types'

export default async function Footer() {
  const {data: settings} = await sanityFetch({
    query: settingsQuery,
  })

  const buttons = (settings?.footerButtons ?? [])
    .filter((b): b is NonNullable<typeof b> => Boolean(b?.buttonText && b?.link))
    .map((b) => ({
      _key: b._key,
      buttonText: b.buttonText!,
      link: b.link as DereferencedLink,
      variant: (b.variant || 'primary') as 'primary' | 'secondary',
      icon: b.icon || undefined,
      iconPosition: (b.iconPosition || 'right') as 'left' | 'right',
    }))

  return (
    <footer className="mt-24 px-6 lg:px-28 pb-8">
      <div className="bg-white rounded-xl border border-gray-200 px-6 lg:px-12 py-12">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-8">
          <div className="flex flex-col gap-3">
            <Link href="/" className="cursor-pointer flex items-center gap-2">
              <Image
                src="/images/webtosvg-logo.svg"
                alt="Web to SVG"
                width={153}
                height={29}
                className="h-7 w-auto"
              />
            </Link>
            {settings?.footerDescription && (
              <div className="text-sm text-gray-500 max-w-xs [&_p]:m-0">
                <PortableText value={settings.footerDescription as PortableTextBlock[]} />
              </div>
            )}
          </div>

          <ButtonGroup buttons={buttons} alignment="right" />
        </div>

        <div className="mt-12 pt-6 border-t border-gray-200 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-gray-400">
          <span>&copy; {new Date().getFullYear()} Web to SVG · <Link href="/privacy" className="hover:text-gray-600 transition-colors">Privacy Policy</Link></span>
          <span>
            Extension by{' '}
            <a
              href="https://markusevanger.no"
              target="_blank"
              rel="noopener noreferrer"
              className="cursor-pointer"
            >
              <span className="inline-block px-1.5 py-0.5 rounded bg-primary text-black font-bold text-[10px]">
                markusevanger.no
              </span>
            </a>
          </span>
        </div>
      </div>
    </footer>
  )
}
