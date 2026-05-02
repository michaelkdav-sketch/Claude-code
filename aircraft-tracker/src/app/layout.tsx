import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'AirWatch SD',
  description: 'Local aircraft tracker — San Diego',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark h-full">
      <head>
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#0d0d14" />
      </head>
      <body className="h-full overflow-hidden bg-surface text-zinc-100 antialiased">
        {children}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              if ('serviceWorker' in navigator) {
                window.addEventListener('load', function() {
                  navigator.serviceWorker.register('/sw.js').catch(function() {});
                });
              }
            `,
          }}
        />
      </body>
    </html>
  )
}
