import {CogIcon, DocumentIcon, EnvelopeIcon} from '@sanity/icons'
import type {StructureResolver} from 'sanity/structure'

export const structure: StructureResolver = (S) =>
  S.list()
    .title('Content')
    .items([
      // Pages
      S.documentTypeListItem('page').title('Pages').icon(DocumentIcon),
      S.divider(),
      // Feedback
      S.listItem()
        .title('Feedback')
        .icon(EnvelopeIcon)
        .child(
          S.list()
            .title('Feedback')
            .items([
              S.listItem()
                .title('Page')
                .icon(DocumentIcon)
                .child(S.document().schemaType('feedbackPage').documentId('feedbackPage')),
              S.documentTypeListItem('feedback').title('Responses').icon(EnvelopeIcon),
            ]),
        ),
      S.divider(),
      // Settings
      S.listItem()
        .title('Site Settings')
        .child(S.document().schemaType('settings').documentId('siteSettings'))
        .icon(CogIcon),
    ])
