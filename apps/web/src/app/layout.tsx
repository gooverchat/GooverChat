import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'GooverChat',
  description: 'Production-ready web chat',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}
