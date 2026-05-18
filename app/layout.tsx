import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'insurance-app',
  icons: { icon: '/favicon.svg' },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="ja">
      <body>
        <div id="root">{children}</div>
      </body>
    </html>
  )
}
