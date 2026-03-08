import Image from 'next/image'
import Link from 'next/link'
import {settingsQuery} from '@/sanity/lib/queries'
import {sanityFetch} from '@/sanity/lib/live'
import ButtonGroup from '@/app/components/ButtonGroup'
import {DereferencedLink} from '@/sanity/lib/types'

export default async function Header() {
  const {data: settings} = await sanityFetch({
    query: settingsQuery,
  })

  const buttons = (settings?.headerButtons ?? [])
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
    <header className="fixed z-50 h-24 inset-0 flex items-center">
      <div className="container py-6 px-2 sm:px-6">
        <div className="flex items-center justify-between gap-5">
          <Link className="cursor-pointer flex items-center gap-2" href="/">
            <Image
              src="/images/webtosvg-logo.svg"
              alt={settings?.title || 'Web to SVG'}
              width={153}
              height={29}
              className="h-7 w-auto"
              priority
            />
          </Link>

          <nav>
            <ButtonGroup buttons={buttons} alignment="right" />
          </nav>
        </div>
      </div>
    </header>
  )
}
