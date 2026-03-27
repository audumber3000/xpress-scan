import { getAllBlogPosts, getAllCategories } from '@/lib/mdx';
import BlogCard from '@/components/blog/BlogCard';
import Sidebar from '@/components/blog/Sidebar';

export const metadata = {
  title: 'Dental Clinic Management Blog | MolarPlus',
  description: 'Pro tips, guides, and insights on the best dental software for clinic management and patient care.',
};

export default function BlogListingPage() {
  const allPosts = getAllBlogPosts();
  const categories = getAllCategories();
  const trendingPosts = allPosts.filter(p => p.isTrending);

  return (
    <div className="min-h-screen bg-white">
      <section className="pt-24 pb-20 bg-gradient-to-b from-[#2a276e]/5 to-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h1 className="text-4xl md:text-6xl font-black text-gray-900 mb-6 tracking-tight">
            Our <span className="text-[#2a276e]">Blog</span>
          </h1>
          <p className="text-lg md:text-xl text-gray-600 max-w-2xl mx-auto leading-relaxed">
            Expert insights, guides, and tips to help you modernize your dental practice with the best clinic management software.
          </p>
        </div>
      </section>

      {/* Main Content */}
      <section className="pb-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col lg:flex-row gap-12">
            {/* Blog Grid */}
            <div className="lg:w-2/3">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {allPosts.map((post) => (
                  <BlogCard key={post.slug} post={post} />
                ))}
              </div>
            </div>

            {/* Sidebar */}
            <div className="lg:w-1/3">
              <div className="sticky top-32">
                <Sidebar categories={categories} trendingPosts={trendingPosts} />
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
