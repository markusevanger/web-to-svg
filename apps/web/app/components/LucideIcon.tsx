import {icons, type LucideProps} from 'lucide-react'

interface LucideIconProps extends LucideProps {
  name: string
}

function toPascalCase(name: string): string {
  return name
    .split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join('')
}

export default function LucideIcon({name, ...props}: LucideIconProps) {
  const pascalName = toPascalCase(name)
  const Icon = icons[pascalName as keyof typeof icons]
  if (!Icon) return null
  return <Icon {...props} />
}
