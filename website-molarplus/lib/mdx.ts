import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';
import readingTime from 'reading-time';

const BLOG_PATH = path.join(process.cwd(), 'content/blogs');

export interface BlogPost {
  title: string;
  description: string;
  date: string;
  slug: string;
  coverImage: string;
  category: string;
  isTrending?: boolean;
  content: string;
  readingTime: string;
  headings: { id: string; text: string; level: number }[];
}

export function getBlogSlugs(): string[] {
  return fs.readdirSync(BLOG_PATH).filter((file) => file.endsWith('.mdx'));
}

export function getBlogPostBySlug(slug: string): BlogPost | null {
  const realSlug = slug.replace(/\.mdx$/, '');
  const fullPath = path.join(BLOG_PATH, `${realSlug}.mdx`);

  if (!fs.existsSync(fullPath)) return null;

  const fileContents = fs.readFileSync(fullPath, 'utf8');
  const { data, content } = matter(fileContents);

  // Simple regex to extract headings
  const headings: { id: string; text: string; level: number }[] = [];
  const headingRegex = /^(#{1,6})\s+(.+)$/gm;
  let match;
  while ((match = headingRegex.exec(content)) !== null) {
    const level = match[1].length;
    const text = match[2];
    const id = text
      .toLowerCase()
      .replace(/[^\w\s-]/g, '')
      .replace(/\s+/g, '-');
    headings.push({ id, text, level });
  }

  return {
    ...data,
    slug: realSlug,
    coverImage: data.coverImage || data.image || `/images/blog/${realSlug}.png`,
    content,
    headings,
    readingTime: readingTime(content).text,
  } as BlogPost;
}

export function getAllBlogPosts(): BlogPost[] {
  const slugs = getBlogSlugs();
  const posts = slugs
    .map((slug) => getBlogPostBySlug(slug))
    .filter((post): post is BlogPost => post !== null)
    .sort((a, b) => (new Date(b.date).getTime() > new Date(a.date).getTime() ? 1 : -1));

  return posts;
}

export function getAllCategories(): { name: string; count: number }[] {
  const posts = getAllBlogPosts();
  const categoryCounts: Record<string, number> = {};

  posts.forEach((post) => {
    if (post.category) {
      categoryCounts[post.category] = (categoryCounts[post.category] || 0) + 1;
    }
  });

  return Object.entries(categoryCounts).map(([name, count]) => ({
    name,
    count,
  }));
}
