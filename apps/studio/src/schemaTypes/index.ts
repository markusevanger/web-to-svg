import {feedback} from './documents/feedback'
import {person} from './documents/person'
import {page} from './documents/page'
import {post} from './documents/post'
import {callToAction} from './objects/callToAction'
import {infoSection} from './objects/infoSection'
import {splitSection} from './objects/splitSection'
import {steps} from './objects/steps'
import {blocks} from './objects/blocks'
import {buttonGroup} from './objects/buttonGroup'
import {mediaSection} from './objects/mediaSection'
import {accordionGroup} from './objects/accordionGroup'
import {settings} from './singletons/settings'
import {link} from './objects/link'
import {blockContent} from './objects/blockContent'
import button from './objects/button'
import {blockContentTextOnly} from './objects/blockContentTextOnly'

// Export an array of all the schema types.  This is used in the Sanity Studio configuration. https://www.sanity.io/docs/studio/schema-types

export const schemaTypes = [
  // Singletons
  settings,
  // Documents
  page,
  post,
  person,
  feedback,
  // Objects
  button,
  blockContent,
  blockContentTextOnly,
  infoSection,
  callToAction,
  splitSection,
  steps,
  blocks,
  buttonGroup,
  mediaSection,
  accordionGroup,
  link,
]
