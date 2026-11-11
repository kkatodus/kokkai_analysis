import type { Metadata } from "next";
import { Analytics } from "@vercel/analytics/next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "KOKKAI DOC",
  description:
    "日本の政治を調べやすく、わかりやすく、身近に。AIをフル活用した国会発言分析プラットフォーム。",
  // link previews for every page (a page's own openGraph replaces this whole block, so / repeats the image)
  openGraph: {
    title: "KOKKAI DOC",
    description: "国会の会議録をAIで読み解いて、議員ごとの発言・やり取り・立場を見られるサイトです。",
    siteName: "KOKKAI DOC",
    locale: "ja_JP",
    type: "website",
    images: [{ url: "https://www.kokkaidoc.com/og-image.png", width: 1200, height: 630, alt: "KOKKAI DOC のトップページ" }],
  },
  twitter: { card: "summary_large_image", site: "@kokkaidoc" },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      <body
        suppressHydrationWarning
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
        <Analytics />
      </body>
    </html>
  );
}
