import type { Metadata } from 'next';
import './globals.css';
import SiteMotion from '@/components/SiteMotion';

export const metadata: Metadata = {
  title: 'AI Photobooth — Dream Job',
  description: 'Discover your dream job with AI-powered photos',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=Inter:wght@400;500;600&display=swap"
          rel="stylesheet"
        />
      </head>
      <body><SiteMotion>{children}</SiteMotion></body>
    </html>
  );
}
