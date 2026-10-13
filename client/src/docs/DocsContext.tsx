'use client'

import { createContext, useContext } from 'react'

// How a link to a page of the documentation behaves where the documentation is shown: on the public pages it is an address, in the
// Help window of the game it shows the page in the window (design §15.5)
export interface DocsNavigation {
  hrefOf(slug: string): string
  // Present where links must not leave the place they are shown in
  open?(slug: string): void
  // The address of the OpenAPI reference
  apiUrl: string
}

const DEFAULT_NAVIGATION: DocsNavigation = { hrefOf: (slug) => `/docs/${slug}`, apiUrl: '' }

export const DocsNavigationContext = createContext<DocsNavigation>(DEFAULT_NAVIGATION)

export const useDocsNavigation = () => useContext(DocsNavigationContext)
