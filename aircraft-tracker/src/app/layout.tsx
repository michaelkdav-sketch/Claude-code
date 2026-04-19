import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'AirWatch SD',
  description: 'Local aircraft tracker — San Diego',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark h-full">
      <body className="h-full overflow-hidden bg-surface text-zinc-100 antialiased">
        {children}
      </body>
    </html>
  )
}
