import Link from 'next/link'

import {linkResolver} from '@/sanity/lib/utils'
import {DereferencedLink} from '@/sanity/lib/types'

interface ResolvedLinkProps {
  link: DereferencedLink
  children: React.ReactNode
  className?: string
}

export default function ResolvedLink({link, children, className}: ResolvedLinkProps) {
  const resolvedLink = linkResolver(link)

  if (typeof resolvedLink === 'string') {
    if (link?.linkType === 'anchor' || link?.linkType === 'href') {
      return (
        <a
          href={resolvedLink}
          className={className}
          target={link?.openInNewTab ? '_blank' : undefined}
          rel={link?.openInNewTab ? 'noopener noreferrer' : undefined}
        >
          {children}
        </a>
      )
    }
    return (
      <Link href={resolvedLink} className={className}>
        {children}
      </Link>
    )
  }
  return <>{children}</>
}
