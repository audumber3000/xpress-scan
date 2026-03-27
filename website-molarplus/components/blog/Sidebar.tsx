import Link from 'next/link';
import Image from 'next/image';
import { Search } from 'lucide-react';
import { BlogPost } from '@/lib/mdx';

interface SidebarProps {
  categories: { name: string; count: number }[];
  trendingPosts: BlogPost[];
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  selectedCategory: string | null;
  setSelectedCategory: (category: string | null) => void;
  totalPosts: number;
}

export default function Sidebar({ 
  categories, 
  trendingPosts, 
  searchQuery, 
  setSearchQuery, 
  selectedCategory, 
  setSelectedCategory,
  totalPosts
}: SidebarProps) {
  return (
    <aside className="space-y-10">
      {/* Search */}
      <div className="bg-white p-2 rounded-2xl border border-gray-100 shadow-sm">
        <div className="relative">
          <input
            type="text"
            placeholder="Enter keyword"
            className="w-full pl-12 pr-4 py-4 bg-gray-50 border-none rounded-xl focus:ring-2 focus:ring-blue-100 transition-all outline-none text-gray-900 placeholder:text-gray-400"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
        </div>
      </div>

      {/* Categories */}
      <div>
        <h4 className="text-xl font-extrabold text-[#1a1c4b] mb-6 tracking-tight">Categories:</h4>
        <ul className="space-y-4">
          <li className="flex items-center justify-between group cursor-pointer" onClick={() => setSelectedCategory(null)}>
            <div className="flex items-center gap-3">
              <div className={`w-5 h-5 border-2 rounded-md transition-all flex items-center justify-center ${selectedCategory === null ? 'bg-blue-600 border-blue-600' : 'border-gray-200 group-hover:border-blue-400'}`}>
                {selectedCategory === null && <div className="w-2 h-2 bg-white rounded-full" />}
              </div>
              <span className={`transition-colors font-bold text-sm ${selectedCategory === null ? 'text-[#1a1c4b]' : 'text-gray-500 group-hover:text-gray-900'}`}>
                All categories
              </span>
            </div>
            <span className="text-gray-400 font-bold text-xs">{totalPosts}</span>
          </li>
          {categories.map((cat) => (
            <li 
              key={cat.name} 
              className="flex items-center justify-between group cursor-pointer"
              onClick={() => setSelectedCategory(cat.name === selectedCategory ? null : cat.name)}
            >
              <div className="flex items-center gap-3">
                <div className={`w-5 h-5 border-2 rounded-md transition-all flex items-center justify-center ${selectedCategory === cat.name ? 'bg-blue-600 border-blue-600' : 'border-gray-200 group-hover:border-blue-400'}`}>
                  {selectedCategory === cat.name && <div className="w-2 h-2 bg-white rounded-full" />}
                </div>
                <span className={`transition-colors font-bold text-sm ${selectedCategory === cat.name ? 'text-[#1a1c4b]' : 'text-gray-500 group-hover:text-gray-900'}`}>
                  {cat.name}
                </span>
              </div>
              <span className="text-gray-400 font-bold text-xs">{cat.count}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* Trending Posts */}
      <div>
        <h4 className="text-xl font-extrabold text-[#1a1c4b] mb-6 tracking-tight">Trending Post:</h4>
        <div className="space-y-6">
          {trendingPosts.map((post) => (
            <Link key={post.slug} href={`/blog/${post.slug}`} className="flex gap-4 group">
              <div className="relative w-24 h-20 shrink-0 rounded-xl overflow-hidden shadow-sm">
                <Image
                  src={post.coverImage}
                  alt={post.title}
                  fill
                  className="object-cover group-hover:scale-110 transition-transform duration-500"
                />
              </div>
              <div className="flex flex-col justify-center">
                <h5 className="text-sm font-bold text-[#1a1c4b] group-hover:text-blue-600 transition-colors line-clamp-2 leading-snug mb-1">
                  {post.title}
                </h5>
                <span className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">
                  {new Date(post.date).toLocaleDateString('en-IN', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                  })}
                </span>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </aside>
  );
}
