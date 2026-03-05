import {defineField, defineType} from 'sanity'
import {InlineIcon} from '@sanity/icons'

export const buttonGroup = defineType({
  name: 'buttonGroup',
  title: 'Button Group',
  type: 'object',
  icon: InlineIcon,
  fields: [
    defineField({
      name: 'buttons',
      title: 'Buttons',
      type: 'array',
      of: [{type: 'button'}],
      validation: (Rule) => Rule.min(1),
    }),
    defineField({
      name: 'alignment',
      title: 'Alignment',
      type: 'string',
      options: {
        list: [
          {title: 'Left', value: 'left'},
          {title: 'Center', value: 'center'},
          {title: 'Right', value: 'right'},
        ],
        layout: 'radio',
      },
      initialValue: 'center',
    }),
  ],
  preview: {
    select: {buttons: 'buttons'},
    prepare({buttons}) {
      const count = buttons?.length || 0
      return {
        title: 'Button Group',
        subtitle: `${count} button${count === 1 ? '' : 's'}`,
      }
    },
  },
})
