// The addresses of the public pages inside a language tree ('' is the home page); the sitemap lists them all
import { DOC_PAGES, docPath } from '../docs/structure'

export const PUBLIC_PATHS: readonly string[] = ['', '/privacy', ...DOC_PAGES.map((page) => docPath(page.slug))]
