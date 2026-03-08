import {defineField, defineType, defineArrayMember} from 'sanity'
import {ThLargeIcon, ComposeSparklesIcon} from '@sanity/icons'

export const blocks = defineType({
  name: 'blocks',
  title: 'Blocks',
  type: 'object',
  icon: ThLargeIcon,
  groups: [{name: 'content', icon: ComposeSparklesIcon, default: true}],
  fields: [
    defineField({
      name: 'anchor',
      title: 'Anchor ID',
      type: 'string',
      description: 'Used for in-page linking (e.g. "features" becomes #features)',
      group: 'content',
    }),
    defineField({
      name: 'heading',
      title: 'Heading',
      type: 'string',
      group: 'content',
    }),
    defineField({
      name: 'items',
      title: 'Blocks',
      type: 'array',
      group: 'content',
      validation: (Rule) => Rule.min(1),
      of: [
        defineArrayMember({
          type: 'object',
          name: 'blockItem',
          fields: [
            defineField({
              name: 'mediaType',
              title: 'Media Type',
              type: 'string',
              options: {
                list: [
                  {title: 'Icon', value: 'icon'},
                  {title: 'Image', value: 'image'},
                ],
                layout: 'radio',
              },
              initialValue: 'icon',
            }),
            defineField({
              name: 'icon',
              title: 'Icon',
              type: 'string',
              description:
                'Lucide icon name (e.g. "zap", "download", "chrome", "image-plus", "layers", "mouse-pointer-click")',
              hidden: ({parent}) => parent?.mediaType === 'image',
            }),
            defineField({
              name: 'image',
              title: 'Image',
              type: 'image',
              options: {hotspot: true},
              hidden: ({parent}) => parent?.mediaType !== 'image',
            }),
            defineField({
              name: 'title',
              title: 'Title',
              type: 'string',
              validation: (Rule) => Rule.required(),
            }),
            defineField({
              name: 'excerpt',
              title: 'Excerpt',
              type: 'array',
              of: [
                defineArrayMember({
                  type: 'block',
                  styles: [{title: 'Normal', value: 'normal'}],
                  lists: [],
                  marks: {
                    decorators: [
                      {title: 'Bold', value: 'strong'},
                      {title: 'Italic', value: 'em'},
                    ],
                    annotations: [],
                  },
                }),
              ],
            }),
          ],
          preview: {
            select: {title: 'title', icon: 'icon'},
            prepare({title, icon}) {
              return {
                title: title || 'Block',
                subtitle: icon ? `Icon: ${icon}` : undefined,
              }
            },
          },
        }),
      ],
    }),
  ],
  preview: {
    select: {title: 'heading', items: 'items'},
    prepare({title, items}) {
      const count = items?.length || 0
      return {
        title: title || 'Blocks',
        subtitle: `Blocks — ${count} item${count === 1 ? '' : 's'}`,
        media: ThLargeIcon,
      }
    },
  },
})
