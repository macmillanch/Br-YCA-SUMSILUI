import type { Metadata } from "next";
import { Fraunces, Public_Sans } from "next/font/google";
import "./globals.css";
import { SiteHeader } from "@/components/site/SiteHeader";
import { SiteFooter } from "@/components/site/SiteFooter";

const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-fraunces",
  display: "swap",
});

const publicSans = Public_Sans({
  subsets: ["latin"],
  variable: "--font-public-sans",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Young Chakma Association — Sumsilui Branch, Mizoram",
    template: "%s | YCA Sumsilui",
  },
  description:
    "The public record of Young Chakma Association, Sumsilui Branch: notices and press releases, ongoing works, photo gallery, and year-by-year finances in public view.",
  applicationName: "YCA Sumsilui",
  metadataBase: new URL("https://yca-sumsilui.example"),
  openGraph: {
    type: "website",
    siteName: "Young Chakma Association — Sumsilui Branch",
    title: "Young Chakma Association — Sumsilui Branch, Mizoram",
    description:
      "Notices, ongoing works, gallery and public financial records of the Sumsilui branch of Young Chakma Association, Mizoram.",
    images: [{ url: "/yca.jpg", width: 1280, height: 1280, alt: "Young Chakma Association emblem" }],
  },
  icons: { icon: "/yca.jpg" },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${fraunces.variable} ${publicSans.variable}`}>
      <body className="flex min-h-dvh flex-col bg-paper text-ink antialiased">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:left-3 focus:top-3 focus:z-50 focus:rounded focus:bg-paper focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-green-900"
        >
          Skip to content
        </a>
        <SiteHeader />
        <main id="main" className="flex-1">
          {children}
        </main>
        <SiteFooter />
      </body>
    </html>
  );
}
