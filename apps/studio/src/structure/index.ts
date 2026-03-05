import {CogIcon, DocumentIcon, DocumentTextIcon, EnvelopeIcon, UserIcon} from '@sanity/icons'
import type {StructureResolver} from 'sanity/structure'

export const structure: StructureResolver = (S) =>
  S.list()
    .title('Content')
    .items([
      // Pages
      S.documentTypeListItem('page').title('Pages').icon(DocumentIcon),
      S.documentTypeListItem('post').title('Posts').icon(DocumentTextIcon),
      S.divider(),
      // People & Feedback
      S.documentTypeListItem('person').title('People').icon(UserIcon),
      S.documentTypeListItem('feedback').title('Feedback').icon(EnvelopeIcon),
      S.divider(),
      // Settings
      S.listItem()
        .title('Site Settings')
        .child(S.document().schemaType('settings').documentId('siteSettings'))
        .icon(CogIcon),
    ])
