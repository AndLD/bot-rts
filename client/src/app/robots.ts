import type { MetadataRoute } from 'next'
import { SITE_URL } from '../site/config'

// The public pages are for everyone; the game and the account pages are not worth indexing
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: '*', allow: '/', disallow: ['/game', '/auth', '/account'] },
    sitemap: `${SITE_URL}/sitemap.xml`
  }
}
