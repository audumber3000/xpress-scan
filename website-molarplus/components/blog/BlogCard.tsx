import Link from 'next/link';
import Image from 'next/image';
import { ArrowRight } from 'lucide-react';
import { BlogPost } from '@/lib/mdx';

export default function BlogCard({ post }: { post: BlogPost }) {
  return (
    <div className="group bg-white rounded-2xl overflow-hidden border border-gray-100 hover:shadow-xl transition-all duration-300 flex flex-col h-full">
      <div className="relative aspect-[16/10] overflow-hidden">
        <Image
          src={post.coverImage}
          alt={post.title}
          fill
          className="object-cover group-hover:scale-105 transition-transform duration-500"
        />
      </div>
      
      <div className="p-6 flex flex-col flex-1">
        <div className="mb-4">
          <span className="inline-block px-3 py-1 bg-orange-50 text-orange-700 text-xs font-bold rounded-md">
            {new Date(post.date).toLocaleDateString('en-GB', {
              day: 'numeric',
              month: 'short',
              year: 'numeric',
            })}
          </span>
        </div>
        
        <h3 className="text-xl font-extrabold text-[#1a1c4b] mb-4 group-hover:text-blue-600 transition-colors line-clamp-2 leading-tight">
          <Link href={`/blog/${post.slug}`}>
            {post.title}
          </Link>
        </h3>
        
        <p className="text-gray-600 text-sm leading-relaxed mb-6 line-clamp-3">
          {post.description}
        </p>
        
        <div className="mt-auto">
          <Link 
            href={`/blog/${post.slug}`}
            className="inline-flex items-center gap-2 text-teal-600 font-bold hover:gap-3 transition-all text-sm group/btn"
          >
            Continue Reading
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    </div>
  );
}
