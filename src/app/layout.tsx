import type { Metadata, Viewport } from "next";
import { Roboto_Condensed, Vazirmatn } from "next/font/google";
import "./globals.css";

const robotoCondensed = Roboto_Condensed({
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  variable: "--font-roboto-condensed",
  display: "swap",
});

const vazirmatn = Vazirmatn({
  subsets: ["latin", "arabic"],
  weight: ["300", "400", "500", "700"],
  variable: "--font-vazirmatn",
  display: "swap",
});

export const metadata: Metadata = {
  title: { default: "POSM SHOP | Sirocco", template: "%s | POSM SHOP" },
  description: "Sirocco point-of-sale materials ordering for Key Account Managers.",
  robots: { index: false, follow: false },
  // Stop iOS turning phone numbers and emails into underlined blue links.
  formatDetection: { telephone: false, email: false, address: false },
};

export const viewport: Viewport = {
  themeColor: "#58a244",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${robotoCondensed.variable} ${vazirmatn.variable}`}>
      <body className="min-h-dvh antialiased">{children}</body>
    </html>
  );
}
