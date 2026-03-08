import {defineQuery} from 'next-sanity'

const linkReference = /* groq */ `
  _type == "link" => {
    "page": select(
      page->_type == "feedbackPage" => "feedback",
      page->slug.current
    ),
  }
`

const linkFields = /* groq */ `
  link {
      ...,
      ${linkReference}
      }
`

const blockContentWithLinks = /* groq */ `
  ...,
  markDefs[]{
    ...,
    ${linkReference}
  }
`

const accordionGroupLinks = /* groq */ `
  _type == "accordionGroup" => {
    ...,
    items[]{
      ...,
      content[]{
        ${blockContentWithLinks}
      }
    }
  }
`

export const settingsQuery = defineQuery(`*[_type == "settings"][0]{
  ...,
  headerButtons[]{
    ...,
    ${linkFields}
  },
  footerButtons[]{
    ...,
    ${linkFields}
  },
  demoFallbackButton {
    ...,
    ${linkFields}
  }
}`)

export const getPageQuery = defineQuery(`
  *[_type == 'page' && slug.current == $slug][0]{
    _id,
    _type,
    name,
    slug,
    heading,
    subheading,
    "pageBuilder": pageBuilder[]{
      ...,
      _type == "callToAction" => {
        ...,
        button {
          ...,
          ${linkFields}
        }
      },
      _type == "infoSection" => {
        content[]{
          ${blockContentWithLinks},
          ${accordionGroupLinks}
        }
      },
      _type == "splitSection" => {
        ...,
        content[]{
          ${blockContentWithLinks},
          ${accordionGroupLinks}
        },
        buttonGroup {
          ...,
          buttons[]{
            ...,
            ${linkFields}
          }
        }
      },
      _type == "steps" => {
        ...,
        steps[]{
          ...,
          text[]{
            ${blockContentWithLinks},
            ${accordionGroupLinks}
          }
        }
      },
    },
  }
`)

export const sitemapData = defineQuery(`
  *[_type == "page" && defined(slug.current)] | order(_type asc) {
    "slug": slug.current,
    _type,
    _updatedAt,
  }
`)

export const frontpageQuery = defineQuery(`
  *[_type == "settings"][0].frontpage->slug.current
`)

export const pagesSlugs = defineQuery(`
  *[_type == "page" && defined(slug.current)]
  {"slug": slug.current}
`)
