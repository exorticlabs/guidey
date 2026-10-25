import { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/admin/', '/api/', '/settings/', '/organisation/'],
    },
    sitemap: 'https://guidey.exortic.com/sitemap.xml',
  };
}
