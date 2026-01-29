import { MetadataRoute } from 'next';
import { SITE_URL } from '@/lib/seo';
import { getAllSlugs } from '@/lib/articles';

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = SITE_URL;
  const lastModified = new Date();

  const staticRoutes = [
    '',
    '/features',
    '/pricing',
    '/about',
    '/contact',
    '/platform',
    '/privacy-policy',
    '/articles',
  ];

  const staticEntries: MetadataRoute.Sitemap = staticRoutes.map((route) => ({
    url: `${baseUrl}${route}`,
    lastModified,
    changeFrequency: route === '' ? 'daily' as const : route === '/privacy-policy' ? 'monthly' as const : 'weekly' as const,
    priority: route === '' ? 1.0 : route === '/features' || route === '/pricing' ? 0.9 : route === '/articles' ? 0.85 : 0.8,
  }));

  const articleSlugs = getAllSlugs();
  const articleEntries: MetadataRoute.Sitemap = articleSlugs.map((slug) => ({
    url: `${baseUrl}/articles/${slug}`,
    lastModified,
    changeFrequency: 'monthly' as const,
    priority: 0.8,
  }));

  return [...staticEntries, ...articleEntries];
}
