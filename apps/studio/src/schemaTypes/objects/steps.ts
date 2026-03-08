import {defineField, defineType, defineArrayMember} from 'sanity'
import {OlistIcon, ComposeSparklesIcon, ImageIcon, ControlsIcon, HighlightIcon} from '@sanity/icons'

export const steps = defineType({
  name: 'steps',
  title: 'Steps',
  type: 'object',
  icon: OlistIcon,
  groups: [
    {name: 'content', icon: ComposeSparklesIcon, default: true},
    {name: 'media', icon: ImageIcon},
    {name: 'design', icon: ControlsIcon},
  ],
  fields: [
    defineField({
      name: 'anchor',
      title: 'Anchor ID',
      type: 'string',
      description: 'Used for in-page linking (e.g. "how-it-works" becomes #how-it-works)',
      group: 'design',
    }),
    defineField({
      name: 'heading',
      title: 'Heading',
      type: 'string',
      validation: (Rule) => Rule.required(),
      group: 'content',
    }),
    defineField({
      name: 'steps',
      title: 'Steps',
      type: 'array',
      group: 'content',
      of: [
        defineArrayMember({
          type: 'object',
          name: 'step',
          fields: [
            defineField({
              name: 'text',
              title: 'Step Text',
              type: 'array',
              description:
                'Use the highlight annotation to add colored backgrounds to key words',
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
                    annotations: [
                      {
                        name: 'highlight',
                        type: 'object',
                        title: 'Highlight',
                        icon: HighlightIcon,
                        fields: [
                          defineField({
                            name: 'color',
                            title: 'Highlight Color',
                            type: 'string',
                            options: {
                              list: [
                                {title: 'Green', value: '#04e762'},
                                {title: 'Yellow', value: '#f5b700'},
                                {title: 'Blue', value: '#008bf8'},
                                {title: 'Pink', value: '#e80080'},
                              ],
                            },
                            initialValue: '#f5b700',
                          }),
                        ],
                      },
                    ],
                  },
                }),
              ],
            }),
          ],
          preview: {
            select: {title: 'text'},
            prepare({title}) {
              const text =
                title?.[0]?.children
                  ?.map((c: {text?: string}) => c.text)
                  .join('') || 'Step'
              return {title: text}
            },
          },
        }),
      ],
    }),
    defineField({
      name: 'image',
      title: 'Image',
      type: 'image',
      options: {hotspot: true},
      group: 'media',
    }),
    defineField({
      name: 'contentAlignment',
      title: 'Content Order',
      type: 'string',
      initialValue: 'textFirst',
      description: 'Does text content or image come first?',
      options: {
        list: [
          {title: 'Text then Image', value: 'textFirst'},
          {title: 'Image then Text', value: 'imageFirst'},
        ],
        layout: 'radio',
      },
      group: 'design',
    }),
  ],
  preview: {
    select: {title: 'heading', steps: 'steps'},
    prepare({title, steps}) {
      const count = steps?.length || 0
      return {
        title: title || 'Steps',
        subtitle: `Steps — ${count} step${count === 1 ? '' : 's'}`,
        media: OlistIcon,
      }
    },
  },
})
