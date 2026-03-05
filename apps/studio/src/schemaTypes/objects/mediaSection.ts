import {defineField, defineType} from 'sanity'
import {PlayIcon, ImageIcon} from '@sanity/icons'

export const mediaSection = defineType({
  name: 'mediaSection',
  title: 'Media (Full Width)',
  type: 'object',
  icon: ImageIcon,
  fields: [
    defineField({
      name: 'anchor',
      title: 'Anchor ID',
      type: 'string',
      description: 'Used for in-page linking (e.g. "demo" becomes #demo)',
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
    }),
    defineField({
      name: 'image',
      title: 'Image',
      type: 'image',
      options: {hotspot: true},
      hidden: ({parent}) => parent?.mediaType === 'video',
    }),
    defineField({
      name: 'video',
      title: 'Video File',
      type: 'file',
      options: {accept: 'video/*'},
      hidden: ({parent}) => parent?.mediaType !== 'video',
    }),
    defineField({
      name: 'videoUrl',
      title: 'Video URL',
      type: 'url',
      description: 'External video URL (e.g. YouTube, Vimeo embed URL)',
      hidden: ({parent}) => parent?.mediaType !== 'video',
    }),
    defineField({
      name: 'caption',
      title: 'Caption',
      type: 'string',
    }),
  ],
  preview: {
    select: {
      caption: 'caption',
      mediaType: 'mediaType',
      image: 'image',
    },
    prepare({caption, mediaType, image}) {
      return {
        title: caption || 'Media (Full Width)',
        subtitle: mediaType === 'video' ? 'Video' : 'Image',
        media: mediaType === 'video' ? PlayIcon : image || ImageIcon,
      }
    },
  },
})
