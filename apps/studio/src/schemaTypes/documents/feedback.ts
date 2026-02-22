import {EnvelopeIcon} from '@sanity/icons'
import {defineField, defineType} from 'sanity'

export const feedback = defineType({
  name: 'feedback',
  title: 'Feedback',
  icon: EnvelopeIcon,
  type: 'document',
  fields: [
    defineField({
      name: 'message',
      title: 'Message',
      type: 'text',
      rows: 4,
      validation: (rule) => rule.required().min(10).error('Message must be at least 10 characters'),
    }),
    defineField({
      name: 'feedbackType',
      title: 'Type',
      type: 'string',
      options: {
        list: [
          {title: 'General', value: 'general'},
          {title: 'Bug Report', value: 'bug'},
          {title: 'Feature Request', value: 'feature'},
        ],
        layout: 'radio',
      },
      initialValue: 'general',
    }),
    defineField({
      name: 'name',
      title: 'Name',
      type: 'string',
    }),
    defineField({
      name: 'email',
      title: 'Email',
      type: 'string',
      validation: (rule) =>
        rule
          .regex(/^[^\s@]+@[^\s@]+\.[^\s@]+$/, {name: 'email'})
          .warning('Should be a valid email'),
    }),
    defineField({
      name: 'screenshot',
      title: 'Screenshot',
      type: 'image',
      options: {hotspot: true},
      fields: [
        {
          name: 'alt',
          type: 'string',
          title: 'Description',
        },
      ],
    }),
    defineField({
      name: 'status',
      title: 'Status',
      type: 'string',
      options: {
        list: [
          {title: 'New', value: 'new'},
          {title: 'Reviewed', value: 'reviewed'},
          {title: 'Resolved', value: 'resolved'},
        ],
        layout: 'radio',
      },
      initialValue: 'new',
    }),
    defineField({
      name: 'createdAt',
      title: 'Submitted At',
      type: 'datetime',
      readOnly: true,
      initialValue: () => new Date().toISOString(),
    }),
  ],
  preview: {
    select: {
      title: 'message',
      subtitle: 'feedbackType',
      status: 'status',
      media: 'screenshot',
    },
    prepare({title, subtitle, status, media}) {
      return {
        title: title?.slice(0, 60) + (title?.length > 60 ? '...' : ''),
        subtitle: `${subtitle ?? 'general'} — ${status ?? 'new'}`,
        media,
      }
    },
  },
  orderings: [
    {
      title: 'Newest First',
      name: 'createdAtDesc',
      by: [{field: 'createdAt', direction: 'desc'}],
    },
  ],
})
