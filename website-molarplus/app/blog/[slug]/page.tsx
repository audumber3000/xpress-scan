import type { Metadata } from 'next';
import Link from 'next/link';
import Image from 'next/image';
import { ArrowLeft, Calendar, Clock, Share2 } from 'lucide-react';
import { notFound } from 'next/navigation';
import { SITE_URL } from '@/lib/seo';
import { getBlogPostBySlug, getBlogSlugs } from '@/lib/mdx';
import { TOC } from '@/components/blog/TOC';

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateStaticParams() {
  return getBlogSlugs().map((slug) => ({ slug: slug.replace(/\.mdx$/, '') }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const post = getBlogPostBySlug(slug);
  if (!post) return { title: 'Blog Post | MolarPlus' };
  return {
    title: `${post.title} | MolarPlus`,
    description: post.description,
    alternates: { canonical: `${SITE_URL}/blog/${slug}` },
    openGraph: {
      title: `${post.title} | MolarPlus`,
      description: post.description,
      url: `${SITE_URL}/blog/${slug}`,
      images: [post.coverImage],
    },
  };
}

export default async function BlogPostPage({ params }: Props) {
  const { slug } = await params;
  const post = getBlogPostBySlug(slug);
  if (!post) notFound();

  return (
    <div className="min-h-screen bg-white">
      {/* Blog Hero */}
      <section className="relative pt-40 pb-20 bg-gray-50 overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="max-w-4xl">
            <Link
              href="/blog"
              className="inline-flex items-center text-blue-600 hover:text-blue-800 font-bold mb-8 group"
            >
              <ArrowLeft className="w-4 h-4 mr-2 group-hover:-translate-x-1 transition-transform" /> Back to Blog
            </Link>
            
            <div className="mb-6">
              <span className="px-4 py-1.5 bg-blue-100 text-blue-700 text-xs font-bold rounded-full uppercase tracking-widest">
                {post.category}
              </span>
            </div>
            
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-extrabold text-[#1a1c4b] mb-8 leading-tight">
              {post.title}
            </h1>
            
            <div className="flex flex-wrap items-center gap-6 pt-6 border-t border-gray-200">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-blue-600 flex items-center justify-center text-white font-bold">
                  M+
                </div>
                <div>
                  <p className="text-[#1a1c4b] font-bold">MolarPlus Team</p>
                  <div className="flex items-center gap-4 text-sm text-gray-500">
                    <span className="flex items-center gap-1.5">
                      <Calendar className="w-4 h-4" />
                      {new Date(post.date).toLocaleDateString('en-IN', {
                        day: 'numeric',
                        month: 'long',
                        year: 'numeric'
                      })}
                    </span>
                    <span className="flex items-center gap-1.5">
                      <Clock className="w-4 h-4" />
                      {post.readingTime}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col lg:flex-row gap-12 py-16">
          {/* Sidebar - Table of Contents */}
          <aside className="lg:w-1/4 hidden lg:block">
            <div className="sticky top-32">
              <TOC headings={post.headings} />
            </div>
          </aside>

          {/* Content */}
          <div className="lg:w-3/4">
            {/* Featured Image */}
            <div className="mb-16 relative aspect-[21/9] rounded-3xl overflow-hidden shadow-2xl">
              <Image 
                src={post.coverImage} 
                alt={post.title} 
                fill
                className="object-cover"
                priority
              />
            </div>

            <article className="prose prose-lg lg:prose-xl prose-blue max-w-none prose-headings:text-[#1a1c4b] prose-headings:font-extrabold prose-p:text-gray-600 prose-p:leading-relaxed prose-a:text-blue-600 prose-img:rounded-3xl prose-code:text-blue-600 prose-code:bg-blue-50 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded-md prose-code:before:content-none prose-code:after:content-none">
              <div dangerouslySetInnerHTML={{ 
                __html: post.content
                  .replace(/\n\n/g, '<br /><br />')
                  .replace(/^# (.+)$/gm, '<h1>$1</h1>')
                  .replace(/^## (.+)$/gm, (match, p1) => `<h2 id="${p1.toLowerCase().replace(/[^\w\s-]/g, '').replace(/\s+/g, '-')}">${p1}</h2>`)
                  .replace(/^### (.+)$/gm, (match, p1) => `<h3 id="${p1.toLowerCase().replace(/[^\w\s-]/g, '').replace(/\s+/g, '-')}">${p1}</h3>`)
              }} />
            </article>
            
            <div className="mt-20 pt-10 border-t border-gray-100 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <span className="text-gray-500 font-bold uppercase text-xs tracking-widest">Share this post</span>
                <div className="flex gap-2">
                  <button className="p-3 rounded-xl bg-gray-50 text-gray-700 hover:bg-blue-600 hover:text-white transition-all">
                    <Share2 className="w-5 h-5" />
                  </button>
                </div>
              </div>
              
              <Link href="/blog" className="text-blue-600 font-bold hover:underline">
                All Posts
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
