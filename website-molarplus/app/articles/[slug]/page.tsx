import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft, Calendar } from 'lucide-react';
import { notFound } from 'next/navigation';
import { SITE_URL } from '@/lib/seo';
import { getArticleBySlug, getAllSlugs } from '@/lib/articles';
import { articleContentMap } from '@/content/articles';

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateStaticParams() {
  return getAllSlugs().map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const article = getArticleBySlug(slug);
  if (!article) return { title: 'Article | MolarPlus' };
  return {
    title: `${article.title} | MolarPlus`,
    description: article.description,
    alternates: { canonical: `${SITE_URL}/articles/${slug}` },
    openGraph: {
      title: `${article.title} | MolarPlus`,
      description: article.description,
      url: `${SITE_URL}/articles/${slug}`,
    },
  };
}

export default async function ArticlePage({ params }: Props) {
  const { slug } = await params;
  const article = getArticleBySlug(slug);
  if (!article) notFound();

  const Content = articleContentMap[slug];
  if (!Content) notFound();

  return (
    <div className="min-h-screen bg-white">
      <article className="pt-32 pb-24">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <Link
            href="/articles"
            className="inline-flex items-center text-gray-600 hover:text-blue-600 font-medium mb-8"
          >
            <ArrowLeft className="w-4 h-4 mr-2" /> Back to Articles
          </Link>

          <header className="mb-12">
            <h1 className="text-3xl md:text-4xl font-extrabold text-gray-900 mb-4">
              {article.title}
            </h1>
            <div className="flex items-center gap-4 text-sm text-gray-500">
              <span className="flex items-center gap-1">
                <Calendar className="w-4 h-4" />
                {new Date(article.date).toLocaleDateString('en-IN', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                })}
              </span>
              {article.readMinutes && (
                <span>{article.readMinutes} min read</span>
              )}
            </div>
          </header>

          <Content />
        </div>
      </article>
    </div>
  );
}
