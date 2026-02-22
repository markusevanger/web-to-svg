import {defineField, defineType} from 'sanity'

export default defineType({
  name: 'button',
  type: 'object',
  description: 'A button with text, link, variant, and optional icon',
  fields: [
    defineField({
      name: 'buttonText',
      title: 'Button Text',
      type: 'string',
    }),
    defineField({
      name: 'link',
      title: 'Button Link',
      type: 'link',
      options: {collapsible: true, collapsed: false},
    }),
    defineField({
      name: 'variant',
      title: 'Variant',
      type: 'string',
      options: {
        list: [
          {title: 'Primary (Filled)', value: 'primary'},
          {title: 'Secondary (Outlined)', value: 'secondary'},
        ],
        layout: 'radio',
      },
      initialValue: 'primary',
    }),
    defineField({
      name: 'icon',
      title: 'Icon',
      type: 'string',
      description: 'Lucide icon name (e.g. "chrome", "arrow-right", "download", "plus", "external-link")',
    }),
    defineField({
      name: 'iconPosition',
      title: 'Icon Position',
      type: 'string',
      options: {
        list: [
          {title: 'Left', value: 'left'},
          {title: 'Right', value: 'right'},
        ],
        layout: 'radio',
      },
      initialValue: 'right',
      hidden: ({parent}) => !parent?.icon,
    }),
  ],
  options: {collapsible: true},
})
