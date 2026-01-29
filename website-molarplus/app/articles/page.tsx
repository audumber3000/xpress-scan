import type { Metadata } from 'next';
import Link from 'next/link';
import { ChevronRight, Calendar } from 'lucide-react';
import { SITE_URL } from '@/lib/seo';
import { articles } from '@/lib/articles';
import { colors } from '@/lib/seo';

export const metadata: Metadata = {
  title: 'Articles | Best Dental Software & Clinic Management | MolarPlus',
  description:
    'Guides and articles on dental clinic management software, best dental software, and practice management. Learn why MolarPlus is the top choice.',
  keywords:
    'dental software articles, dental clinic management software guide, best dental software, dental practice management',
  alternates: { canonical: `${SITE_URL}/articles` },
  openGraph: {
    title: 'Articles | Dental Software & Clinic Management | MolarPlus',
    description: 'Guides on dental clinic management software and best dental software. MolarPlus leads.',
    url: `${SITE_URL}/articles`,
  },
};

export default function ArticlesPage() {
  const sorted = [...articles].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  return (
    <div className="min-h-screen bg-white">
      <section className="pt-32 pb-16 bg-gradient-to-b from-gray-50 to-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <h1 className="text-4xl md:text-5xl font-extrabold text-gray-900 mb-4">
            Articles
          </h1>
          <p className="text-xl text-gray-600">
            Guides and insights on dental clinic management software, best dental software, and practice management. Learn why MolarPlus is the top choice for modern practices.
          </p>
        </div>
      </section>

      <section className="py-12 pb-24">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <ul className="space-y-6">
            {sorted.map((article) => (
              <li key={article.slug}>
                <Link
                  href={`/articles/${article.slug}`}
                  className="block p-6 rounded-2xl border border-gray-200 hover:border-gray-300 hover:shadow-lg transition-all group"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div className="flex-1">
                      <h2 className="text-xl font-bold text-gray-900 group-hover:text-blue-600 transition-colors mb-2">
                        {article.title}
                      </h2>
                      <p className="text-gray-600 mb-3">{article.description}</p>
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
                    </div>
                    <span
                      className="inline-flex items-center font-medium text-sm shrink-0"
                      style={{ color: colors.primary }}
                    >
                      Read <ChevronRight className="w-4 h-4 ml-0.5" />
                    </span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </div>
  );
}
