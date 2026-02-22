import {
  Chrome,
  ArrowRight,
  Download,
  ExternalLink,
  Plus,
  ArrowLeft,
  Check,
  ChevronRight,
  Play,
  Zap,
  MessageSquarePlus,
  X,
  ImagePlus,
  Layers,
  MousePointerClick,
  Palette,
  FileCode,
  Sparkles,
  Eye,
  Copy,
  Settings,
  type LucideProps,
} from 'lucide-react'
import type {ComponentType} from 'react'

const iconMap: Record<string, ComponentType<LucideProps>> = {
  chrome: Chrome,
  'arrow-right': ArrowRight,
  'arrow-left': ArrowLeft,
  download: Download,
  'external-link': ExternalLink,
  plus: Plus,
  check: Check,
  'chevron-right': ChevronRight,
  play: Play,
  zap: Zap,
  'message-square-plus': MessageSquarePlus,
  x: X,
  'image-plus': ImagePlus,
  layers: Layers,
  'mouse-pointer-click': MousePointerClick,
  palette: Palette,
  'file-code': FileCode,
  sparkles: Sparkles,
  eye: Eye,
  copy: Copy,
  settings: Settings,
}

interface LucideIconProps extends LucideProps {
  name: string
}

export default function LucideIcon({name, ...props}: LucideIconProps) {
  const Icon = iconMap[name]
  if (!Icon) return null
  return <Icon {...props} />
}
