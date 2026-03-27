import './globals.css';
import { Inter } from 'next/font/google';
import Nav from '@/components/Nav';
import Footer from '@/components/Footer';
import { SITE_URL, SITE_NAME, DEFAULT_DESCRIPTION, DEFAULT_KEYWORDS } from '@/lib/seo';

const inter = Inter({ subsets: ['latin'] });

export const metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: `${SITE_NAME} | Best Dental Clinic Management Software`,
    template: `%s | ${SITE_NAME}`,
  },
  description: DEFAULT_DESCRIPTION,
  keywords: DEFAULT_KEYWORDS,
  alternates: {
    canonical: '/',
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
};

import GoogleAnalytics from '@/components/GoogleAnalytics';

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <GoogleAnalytics gaId={process.env.NEXT_PUBLIC_GA_ID || ''} />
        <Nav />
        <main>{children}</main>
        <Footer />
      </body>
    </html>
  );
}
