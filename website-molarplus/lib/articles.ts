export interface ArticleMeta {
  slug: string;
  title: string;
  description: string;
  date: string;
  readMinutes?: number;
}

export const articles: ArticleMeta[] = [
  {
    slug: 'why-choose-best-dental-software',
    title: 'Why Choose the Best Dental Software and Dental Clinic Management Software?',
    description:
      'Finding the best dental software for your practice can transform how you manage appointments, patient records, and daily operations. Learn what to look for and why MolarPlus leads.',
    date: '2025-01-15',
    readMinutes: 5,
  },
  {
    slug: 'top-5-dental-clinic-management-software',
    title: 'Top 5 Best Dental Clinic Management Software in 2025',
    description:
      'Compare the top dental clinic management software: MolarPlus, Dentrix, Open Dental, Curve, and CareStack. See why MolarPlus is the best choice for modern practices.',
    date: '2025-01-20',
    readMinutes: 7,
  },
  {
    slug: 'how-to-choose-dental-practice-management-software',
    title: 'How to Choose Dental Practice Management Software',
    description:
      'A practical guide to evaluating dental practice management software. Features, pricing, support, and why MolarPlus fits practices of all sizes.',
    date: '2025-01-22',
    readMinutes: 6,
  },
  {
    slug: 'dental-software-india-guide',
    title: 'Dental Software India: A Complete Guide for Indian Practices',
    description:
      'Best dental software for Indian clinics: INR pricing, Hindi support, GST, and local compliance. Why MolarPlus is the top dental software in India.',
    date: '2025-01-25',
    readMinutes: 6,
  },
  {
    slug: 'dental-clinic-software-features-that-matter',
    title: 'Dental Clinic Software Features That Actually Matter',
    description:
      'Which features matter most in dental clinic management software? Scheduling, patient records, billing, and mobile access — and how MolarPlus delivers them.',
    date: '2025-01-28',
    readMinutes: 5,
  },
];

export function getArticleBySlug(slug: string): ArticleMeta | undefined {
  return articles.find((a) => a.slug === slug);
}

export function getAllSlugs(): string[] {
  return articles.map((a) => a.slug);
}
