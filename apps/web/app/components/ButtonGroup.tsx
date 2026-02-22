import Button from '@/app/components/Button'
import {DereferencedLink} from '@/sanity/lib/types'

type ButtonItem = {
  _key: string
  buttonText?: string
  link?: DereferencedLink
  variant?: 'primary' | 'secondary'
  icon?: string
  iconPosition?: 'left' | 'right'
}

type ButtonGroupProps = {
  buttons?: ButtonItem[]
  alignment?: 'left' | 'center' | 'right'
}

const alignmentStyles = {
  left: 'justify-start',
  center: 'justify-center',
  right: 'justify-end',
}

export default function ButtonGroup({buttons, alignment = 'center'}: ButtonGroupProps) {
  if (!buttons?.length) return null

  return (
    <div className={`flex flex-col sm:flex-row items-center gap-3 ${alignmentStyles[alignment]}`}>
      {buttons.map((button) => (
        <Button
          key={button._key}
          buttonText={button.buttonText}
          link={button.link}
          variant={button.variant}
          icon={button.icon}
          iconPosition={button.iconPosition}
        />
      ))}
    </div>
  )
}
