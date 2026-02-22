import ResolvedLink from '@/app/components/ResolvedLink'
import LucideIcon from '@/app/components/LucideIcon'
import DemoButton from '@/app/components/DemoButton'
import {DereferencedLink} from '@/sanity/lib/types'

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
  if (link?.linkType === 'demo') {
    return <DemoButton label={buttonText} icon={icon} iconPosition={iconPosition} variant={variant} />
  }

  if (!buttonText || !link) return null

  const content = (
    <>
      {icon && iconPosition === 'left' && <LucideIcon name={icon} className="w-5 h-5" />}
      <span>{buttonText}</span>
      {icon && iconPosition === 'right' && <LucideIcon name={icon} className="w-5 h-5" />}
    </>
  )

  return (
    <ResolvedLink
      link={link}
      className={`inline-flex items-center gap-2 text-sm whitespace-nowrap ${variantStyles[variant]}`}
    >
      {content}
    </ResolvedLink>
  )
}
