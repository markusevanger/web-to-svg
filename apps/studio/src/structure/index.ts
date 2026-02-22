import {CogIcon} from '@sanity/icons'
import type {StructureBuilder, StructureResolver} from 'sanity/structure'
import pluralize from 'pluralize-esm'

const DISABLED_TYPES = ['settings', 'assist.instruction.context']

export const structure: StructureResolver = (S: StructureBuilder) =>
  S.list()
    .title('Content')
    .items([
      ...S.documentTypeListItems()
        .filter((listItem: any) => !DISABLED_TYPES.includes(listItem.getId()))
        .map((listItem) => listItem.title(pluralize(listItem.getTitle() as string))),
      S.listItem()
        .title('Site Settings')
        .child(S.document().schemaType('settings').documentId('siteSettings'))
        .icon(CogIcon),
    ])
