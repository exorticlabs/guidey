import { MetadataRoute } from 'next';

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = 'https://guidey.exortic.com';
  const routes = ['', '/login', '/signup', '/privacy', '/terms', '/contact'];
  
  return routes.map((route) => ({
    url: `${baseUrl}${route}`,
    lastModified: new Date(),
    changeFrequency: route === '' ? 'weekly' : 'monthly',
    priority: route === '' ? 1.0 : route === '/login' || route === '/signup' ? 0.8 : 0.5,
  }));
}
