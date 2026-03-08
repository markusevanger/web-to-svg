import {EnvelopeIcon} from '@sanity/icons'
import {defineField, defineType} from 'sanity'

export const feedbackPage = defineType({
  name: 'feedbackPage',
  title: 'Feedback Page',
  type: 'document',
  icon: EnvelopeIcon,
  fields: [
    defineField({
      name: 'slug',
      title: 'Slug',
      type: 'slug',
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'heading',
      title: 'Heading',
      type: 'string',
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'subheading',
      title: 'Subheading',
      type: 'string',
    }),
    defineField({
      name: 'description',
      title: 'Description',
      type: 'blockContentTextOnly',
    }),
  ],
  preview: {
    prepare() {
      return {
        title: 'Feedback Page',
      }
    },
  },
})
