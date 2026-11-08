import type { MetadataRoute } from 'next';
import { siteOrigin } from '@/lib/seo';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/admin', '/api/', '/wishlist', '/request-status', '/try-on/'],
    },
    sitemap: `${siteOrigin}/sitemap.xml`,
  };
}
