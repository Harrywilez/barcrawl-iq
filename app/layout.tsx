import type { Metadata, Viewport } from "next";
import { Archivo, Playfair_Display, Space_Mono } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";

// Paper design type system, loaded via next/font (self-hosted, no runtime
// Google <link>): Archivo = sans body (variable, 400–800), Playfair Display =
// serif display incl. italic (variable), Space Mono = mono labels (400/700).
const archivo = Archivo({
  subsets: ["latin"],
  variable: "--font-archivo",
});

const playfair = Playfair_Display({
  subsets: ["latin"],
  style: ["normal", "italic"],
  variable: "--font-playfair",
});

const spaceMono = Space_Mono({
  subsets: ["latin"],
  weight: ["400", "700"],
  variable: "--font-space-mono",
});

export const metadata: Metadata = {
  title: "BarCrawl IQ",
  description: "Smart routes for a great night out.",
};

// iOS target: viewport-fit=cover so the paper bg reaches the screen edges
// (pages re-pad with safe-area insets); theme-color tints the status bar paper.
export const viewport: Viewport = {
  themeColor: "#f6f1e6",
  colorScheme: "light",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${archivo.variable} ${playfair.variable} ${spaceMono.variable} antialiased`}
    >
      <body className="flex min-h-[100dvh] flex-col">
        {children}
        <Analytics />
      </body>
    </html>
  );
}
