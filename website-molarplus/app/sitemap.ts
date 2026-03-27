import { MetadataRoute } from 'next';
import { SITE_URL } from '@/lib/seo';
import { getBlogSlugs } from '@/lib/mdx';

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = SITE_URL;
  const lastModified = new Date();

  // Define static routes with their specific change frequencies and priorities
  const staticRoutes = [
    { url: '', changeFrequency: 'daily', priority: 1.0 },
    { url: '/features', changeFrequency: 'weekly', priority: 0.9 },
    { url: '/pricing', changeFrequency: 'weekly', priority: 0.9 },
    { url: '/find-dentist', changeFrequency: 'daily', priority: 0.9 },
    { url: '/blog', changeFrequency: 'daily', priority: 0.85 },
    { url: '/about', changeFrequency: 'monthly', priority: 0.7 },
    { url: '/contact', changeFrequency: 'monthly', priority: 0.7 },
    { url: '/platform', changeFrequency: 'monthly', priority: 0.7 },
    { url: '/privacy-policy', changeFrequency: 'yearly', priority: 0.3 },
  ];

  const staticEntries: MetadataRoute.Sitemap = staticRoutes.map((route) => ({
    url: `${baseUrl}${route.url}`,
    lastModified,
    changeFrequency: route.changeFrequency as any,
    priority: route.priority,
  }));

  // Generate dynamic blog entries from MDX files
  const blogSlugs = getBlogSlugs();
  const blogEntries: MetadataRoute.Sitemap = blogSlugs.map((slug) => ({
    url: `${baseUrl}/blog/${slug.replace(/\.mdx$/, '')}`,
    lastModified,
    changeFrequency: 'weekly' as const,
    priority: 0.8,
  }));

  return [...staticEntries, ...blogEntries];
}
