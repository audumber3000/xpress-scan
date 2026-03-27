import type { Metadata } from 'next';
import { SITE_URL } from '@/lib/seo';
import { getAllBlogPosts, getAllCategories } from '@/lib/mdx';
import BlogClient from '@/components/blog/BlogClient';

export const metadata: Metadata = {
  title: 'Blog | Best Dental Software & Clinic Management | MolarPlus',
  description:
    'Expert guides and insights on dental clinic management software, best practices, and practice growth. Learn why MolarPlus is the top choice.',
  alternates: { canonical: `${SITE_URL}/blog` },
};

export default function BlogPage() {
  const posts = getAllBlogPosts();
  const categories = getAllCategories();

  return (
    <div className="min-h-screen bg-white">
      {/* Search Header Space (Matching Nav padding) */}
      <div className="pt-24" />
      
      <BlogClient initialPosts={posts} categories={categories} />
    </div>
  );
}
