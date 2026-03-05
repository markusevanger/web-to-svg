'use client'

import {useRouter} from 'next/navigation'
import LucideIcon from '@/app/components/LucideIcon'
import DemoButton from '@/app/components/DemoButton'
import {DereferencedLink} from '@/sanity/lib/types'
import {linkResolver} from '@/sanity/lib/utils'

type ButtonProps = {
  buttonText?: string
  link?: DereferencedLink
  variant?: 'primary' | 'secondary'
  icon?: string
  iconPosition?: 'left' | 'right'
}

const variantStyles = {
  primary:
    'cursor-pointer bg-primary text-black font-bold rounded-full px-6 py-3 hover:bg-primary-dark transition-colors duration-200',
  secondary:
    'cursor-pointer border border-primary text-black font-normal rounded-full px-6 py-3 hover:bg-primary/10 transition-colors duration-200',
}

export default function Button({
  buttonText,
  link,
  variant = 'primary',
  icon,
  iconPosition = 'right',
}: ButtonProps) {
  const router = useRouter()

  if (link?.linkType === 'demo') {
    return <DemoButton label={buttonText} icon={icon} iconPosition={iconPosition} variant={variant} />
  }

  if (!buttonText || !link) return null

  const href = linkResolver(link)

  const handleClick = () => {
    if (!href) return
    if (link.linkType === 'href' || link.openInNewTab) {
      window.open(href, '_blank', 'noopener,noreferrer')
    } else if (link.linkType === 'anchor') {
      window.location.hash = href
    } else {
      router.push(href)
    }
  }

  return (
    <button
      onClick={handleClick}
      className={`inline-flex items-center gap-2 text-sm whitespace-nowrap ${variantStyles[variant]}`}
    >
      {icon && iconPosition === 'left' && <LucideIcon name={icon} className="w-5 h-5" />}
      <span>{buttonText}</span>
      {icon && iconPosition === 'right' && <LucideIcon name={icon} className="w-5 h-5" />}
    </button>
  )
}
