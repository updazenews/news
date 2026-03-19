import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Updaze News Demo',
  description: 'A static Next.js demo deployment for Updaze News on GitHub Pages.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
