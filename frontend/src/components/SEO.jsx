import React from 'react';
import { Helmet } from 'react-helmet-async';

const SEO = ({ 
  title = "BetterClinic - Best Clinic Management Software | Medical Practice Management System",
  description = "Better Clinic is the leading clinic management software for doctors, dentists, radiologists & physiotherapists. Features patient management, WhatsApp integration, voice reporting, payments tracking & more. Start your free trial today!",
  keywords = "better clinic, better clinic software, clinic management software, medical clinic software, healthcare management system, patient management system, doctor appointment software, radiology clinic software, dental clinic software, physiotherapy clinic software, clinic EHR software, medical practice management",
  image = "https://betterclinic.app/og-image.png",
  url = "https://betterclinic.app/",
  type = "website",
  author = "BetterClinic",
  structuredData = null
}) => {
  return (
    <Helmet>
      {/* Primary Meta Tags */}
      <title>{title}</title>
      <meta name="title" content={title} />
      <meta name="description" content={description} />
      <meta name="keywords" content={keywords} />
      <meta name="author" content={author} />
      <link rel="canonical" href={url} />

      {/* Open Graph / Facebook */}
      <meta property="og:type" content={type} />
      <meta property="og:url" content={url} />
      <meta property="og:title" content={title} />
      <meta property="og:description" content={description} />
      <meta property="og:image" content={image} />

      {/* Twitter */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:url" content={url} />
      <meta name="twitter:title" content={title} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={image} />

      {/* Structured Data */}
      {structuredData && (
        <script type="application/ld+json">
          {JSON.stringify(structuredData)}
        </script>
      )}
    </Helmet>
  );
};

export default SEO;

