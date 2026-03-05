import {defineField, defineType, defineArrayMember} from 'sanity'
import {ChevronDownIcon} from '@sanity/icons'

export const accordionGroup = defineType({
  name: 'accordionGroup',
  title: 'Accordion Group',
  type: 'object',
  icon: ChevronDownIcon,
  fields: [
    defineField({
      name: 'items',
      title: 'Accordion Items',
      type: 'array',
      of: [
        defineArrayMember({
          type: 'object',
          name: 'accordionItem',
          title: 'Accordion Item',
          fields: [
            defineField({
              name: 'title',
              title: 'Title',
              type: 'string',
              validation: (Rule) => Rule.required(),
            }),
            defineField({
              name: 'content',
              title: 'Content',
              type: 'blockContentTextOnly',
            }),
          ],
          preview: {
            select: {
              title: 'title',
            },
          },
        }),
      ],
      validation: (Rule) => Rule.min(1),
    }),
  ],
  preview: {
    select: {
      items: 'items',
    },
    prepare({items}) {
      const count = items?.length || 0
      return {
        title: 'Accordion Group',
        subtitle: `${count} item${count === 1 ? '' : 's'}`,
      }
    },
  },
})
