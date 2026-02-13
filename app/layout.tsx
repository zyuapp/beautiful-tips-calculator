import type { Metadata } from "next";
import { IBM_Plex_Mono, Noto_Sans } from "next/font/google";
import "./globals.css";

const notoSans = Noto_Sans({
  variable: "--font-body",
  subsets: ["latin"],
  display: "swap",
});

const ibmPlexMono = IBM_Plex_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Beautiful Tips Calculator",
  description: "A modern, feature-rich tip calculator with beautiful UI/UX. Split bills, calculate tips, and save money with friends.",
  keywords: ["tip calculator", "bill splitter", "restaurant tips", "gratuity calculator"],
  authors: [{ name: "Beautiful Tips Calculator" }],
  openGraph: {
    title: "Beautiful Tips Calculator",
    description: "Split bills and calculate tips with ease",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#000000" />
      </head>
      <body
        className={`${notoSans.variable} ${ibmPlexMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
