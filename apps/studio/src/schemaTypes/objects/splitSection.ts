import {defineField, defineType} from 'sanity'
import {
  SplitVerticalIcon,
  ComposeSparklesIcon,
  ImageIcon,
  ControlsIcon,
} from '@sanity/icons'

export const splitSection = defineType({
  name: 'splitSection',
  title: 'Split Section',
  type: 'object',
  icon: SplitVerticalIcon,
  groups: [
    {
      name: 'contents',
      icon: ComposeSparklesIcon,
      default: true,
    },
    {
      name: 'media',
      icon: ImageIcon,
    },
    {
      name: 'designSystem',
      icon: ControlsIcon,
    },
  ],
  fields: [
    defineField({
      name: 'anchor',
      title: 'Anchor ID',
      type: 'string',
      description: 'Used for in-page linking (e.g. "features" becomes #features)',
      group: 'designSystem',
    }),
    defineField({
      name: 'heading',
      title: 'Heading',
      type: 'string',
      validation: (Rule) => Rule.required(),
      group: 'contents',
    }),
    defineField({
      name: 'subheading',
      title: 'Subheading',
      type: 'string',
      group: 'contents',
    }),
    defineField({
      name: 'content',
      title: 'Content',
      type: 'blockContent',
      group: 'contents',
    }),
    defineField({
      name: 'mediaType',
      title: 'Media Type',
      type: 'string',
      options: {
        list: [
          {title: 'Image', value: 'image'},
          {title: 'Video', value: 'video'},
          {title: 'Animated Shapes', value: 'shapes'},
        ],
        layout: 'radio',
      },
      initialValue: 'image',
      group: 'media',
    }),
    defineField({
      name: 'image',
      title: 'Image',
      type: 'image',
      options: {
        hotspot: true,
      },
      hidden: ({parent}) => parent?.mediaType !== 'image',
      group: 'media',
    }),
    defineField({
      name: 'video',
      title: 'Video File',
      type: 'file',
      options: {
        accept: 'video/*',
      },
      hidden: ({parent}) => parent?.mediaType !== 'video',
      group: 'media',
    }),
    defineField({
      name: 'videoUrl',
      title: 'Video URL',
      type: 'url',
      description: 'External video URL (e.g. YouTube, Vimeo embed URL)',
      hidden: ({parent}) => parent?.mediaType !== 'video',
      group: 'media',
    }),
    defineField({
      name: 'shapeCount',
      title: 'Shape Count',
      type: 'number',
      description: 'Number of animated shapes to display',
      initialValue: 6,
      validation: (Rule) => Rule.min(1).max(20),
      hidden: ({parent}) => parent?.mediaType !== 'shapes',
      group: 'media',
    }),
    defineField({
      name: 'contentAlignment',
      title: 'Content Order',
      type: 'string',
      initialValue: 'textFirst',
      description: 'Does text content or media come first?',
      options: {
        list: [
          {title: 'Text then Media', value: 'textFirst'},
          {title: 'Media then Text', value: 'imageFirst'},
        ],
        layout: 'radio',
      },
      group: 'designSystem',
    }),
  ],
  preview: {
    select: {
      title: 'heading',
      subtitle: 'subheading',
      mediaType: 'mediaType',
      image: 'image',
    },
    prepare({title, subtitle, mediaType, image}) {
      const mediaLabel = mediaType === 'video' ? 'Video' : mediaType === 'shapes' ? 'Shapes' : 'Image'
      return {
        title: title || 'Untitled Split Section',
        subtitle: subtitle || `Split Section — ${mediaLabel}`,
        media: image || undefined,
      }
    },
  },
})
