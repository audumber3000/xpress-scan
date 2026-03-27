import { notFound } from 'next/navigation';
import Image from 'next/image';
import { getBlogPostBySlug, getBlogSlugs } from '@/lib/mdx';
import { MDXRemote } from 'next-mdx-remote/rsc';
import { Calendar, Clock, ChevronLeft } from 'lucide-react';
import Link from 'next/link';
import { TOC } from '@/components/blog/TOC';
import rehypeSlug from 'rehype-slug';
import rehypeHighlight from 'rehype-highlight';
import 'highlight.js/styles/github-dark.css';

export async function generateStaticParams() {
  const slugs = getBlogSlugs();
  return slugs.map((slug) => ({
    slug: slug.replace(/\.mdx$/, ''),
  }));
}

export async function generateMetadata({ params }: { params: { slug: string } }) {
  const post = getBlogPostBySlug(params.slug);
  if (!post) return {};

  return {
    title: `${post.title} | MolarPlus Blog`,
    description: post.description,
    openGraph: {
      title: post.title,
      description: post.description,
      type: 'article',
      publishedTime: post.date,
      images: [post.image],
    },
  };
}

export default async function BlogPostPage({ params }: { params: { slug: string } }) {
  const post = getBlogPostBySlug(params.slug);

  if (!post) {
    notFound();
  }

  return (
    <article className="min-h-screen bg-white">
      {/* Hero Section */}
      <section className="pt-24 pb-16 bg-gray-50">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <Link 
            href="/blog"
            className="inline-flex items-center gap-2 text-sm font-bold text-gray-500 hover:text-[#2a276e] transition-colors mb-8"
          >
            <ChevronLeft className="w-4 h-4" />
            Back to Blog
          </Link>
          
          <div className="mb-6">
            <span className="text-[#2a276e] text-sm font-black tracking-widest uppercase">
              {post.category}
            </span>
          </div>
          
          <h1 className="text-4xl md:text-5xl font-black text-gray-900 mb-8 leading-tight tracking-tight">
            {post.title}
          </h1>
          
          <div className="flex flex-wrap items-center gap-6 text-gray-500 font-medium">
            <div className="flex items-center gap-2">
              <Calendar className="w-5 h-5" />
              {new Date(post.date).toLocaleDateString('en-IN', {
                day: 'numeric',
                month: 'long',
                year: 'numeric',
              })}
            </div>
            <div className="flex items-center gap-2">
              <Clock className="w-5 h-5" />
              {post.readingTime}
            </div>
          </div>
        </div>
      </section>

      {/* Featured Image */}
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 -mt-8 mb-16">
        <div className="relative aspect-[21/9] rounded-3xl overflow-hidden shadow-2xl border-8 border-white">
          <Image
            src={post.image}
            alt={post.title}
            fill
            className="object-cover"
            priority
          />
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pb-24">
        <div className="flex flex-col lg:flex-row gap-12">
          <div className="lg:w-3/4">
            <div className="prose prose-lg md:prose-xl prose-slate max-w-none 
              prose-headings:font-black prose-headings:tracking-tight prose-headings:text-gray-900
              prose-p:text-gray-600 prose-p:leading-relaxed
              prose-strong:text-gray-900 prose-strong:font-bold
              prose-img:rounded-3xl prose-img:shadow-lg
              prose-a:text-[#2a276e] hover:prose-a:text-[#4a4694]">
              <MDXRemote 
                source={post.content} 
                options={{
                  mdxOptions: {
                    rehypePlugins: [rehypeSlug, rehypeHighlight],
                  },
                }}
              />
            </div>
          </div>
          
          <div className="lg:w-1/4">
            <div className="sticky top-32">
              <TOC headings={post.headings} />
            </div>
          </div>
        </div>
      </div>
    </article>
  );
}
