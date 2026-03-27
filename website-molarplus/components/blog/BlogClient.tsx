'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { Search } from 'lucide-react';
import { BlogPost } from '@/lib/mdx';
import BlogCard from '@/components/blog/BlogCard';
import Sidebar from './Sidebar';

interface BlogClientProps {
  initialPosts: BlogPost[];
  categories: { name: string; count: number }[];
}

export default function BlogClient({ initialPosts, categories }: BlogClientProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  const filteredPosts = useMemo(() => {
    return initialPosts.filter((post) => {
      const matchesSearch = post.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          post.description.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCategory = selectedCategory ? post.category === selectedCategory : true;
      return matchesSearch && matchesCategory;
    });
  }, [searchQuery, selectedCategory, initialPosts]);

  const trendingPosts = useMemo(() => initialPosts.slice(0, 4), [initialPosts]);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="flex flex-col lg:flex-row gap-12">
        {/* Main Content */}
        <div className="lg:w-2/3">
          <div className="grid md:grid-cols-2 gap-8">
            {filteredPosts.length > 0 ? (
              filteredPosts.map((post) => (
                <BlogCard key={post.slug} post={post} />
              ))
            ) : (
              <div className="col-span-full py-20 text-center">
                <p className="text-gray-500 text-lg">No posts found matching your criteria.</p>
                <button 
                  onClick={() => { setSearchQuery(''); setSelectedCategory(null); }}
                  className="mt-4 text-blue-600 font-bold hover:underline"
                >
                  Clear all filters
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Sidebar */}
        <div className="lg:w-1/3">
          <Sidebar 
            categories={categories} 
            trendingPosts={trendingPosts}
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            selectedCategory={selectedCategory}
            setSelectedCategory={setSelectedCategory}
            totalPosts={initialPosts.length}
          />
        </div>
      </div>
    </div>
  );
}
