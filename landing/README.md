# Landing Pages - Static HTML

This folder contains static HTML landing pages for better SEO performance. These pages are separate from the React application.

## Structure

```
landing/
├── index.html          # Main landing page
├── assets/             # Images, logos, and other assets
│   ├── clino-health-logo.svg
│   ├── clino-health-logo-full.svg
│   └── *.png          # Screenshot images
└── README.md
```

## Features

- **SEO Optimized**: Full meta tags, structured data (JSON-LD), Open Graph, Twitter Cards
- **Fast Loading**: Static HTML with Tailwind CSS CDN
- **Responsive**: Mobile-first design
- **Color Palette**: 
  - Dark Green: `#143601`
  - Medium Green: `#245501`
  - Light Green: `#73a942`

## Deployment

These static HTML files can be:
1. Served directly from a web server (nginx, Apache)
2. Deployed to static hosting (Vercel, Netlify, GitHub Pages)
3. Served from a CDN for maximum performance

## SEO Benefits

- **Faster Indexing**: Search engines can crawl static HTML immediately
- **Better Performance**: No JavaScript required for initial render
- **Structured Data**: JSON-LD schemas for Organization, SoftwareApplication, FAQPage
- **Semantic HTML**: Proper heading hierarchy and semantic elements

## Notes

- All links to `/signup` and other app routes should point to your React app
- Images are optimized and stored in the `assets/` folder
- The design matches the React app but is pure HTML/CSS for better SEO
