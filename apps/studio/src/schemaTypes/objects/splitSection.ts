import {defineField, defineType} from 'sanity'
import {
  BlockContentIcon,
  ComposeSparklesIcon,
  ImageIcon,
  ControlsIcon,
} from '@sanity/icons'

export const splitSection = defineType({
  name: 'splitSection',
  title: 'Split Section',
  type: 'object',
  icon: BlockContentIcon,
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
      hidden: ({parent}) => parent?.mediaType === 'video',
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
      image: 'image',
    },
    prepare({title, subtitle, image}) {
      return {
        title: title || 'Untitled Split Section',
        subtitle: subtitle || 'Split Section',
        media: image || undefined,
      }
    },
  },
})
