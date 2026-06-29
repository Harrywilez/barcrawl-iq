import type { Metadata, Viewport } from "next";
import { Manrope, Space_Grotesk } from "next/font/google";
import "./globals.css";
import Fireworks from "@/components/Fireworks";

// Manrope — UI/body. Space Grotesk — display wordmark + headings. Both are
// variable fonts, so no explicit `weight` is needed; we expose each as a CSS
// custom property and wire them into the Tailwind theme in globals.css.
const manrope = Manrope({
  variable: "--font-manrope",
  subsets: ["latin"],
});

const spaceGrotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "BarCrawl IQ",
  description: "Smart routes for a great night out.",
};

// iOS target: viewport-fit=cover lets the navy backdrop bleed under the notch +
// home indicator (pages then re-pad with safe-area insets), and theme-color
// tints the status bar to match the deep navy.
export const viewport: Viewport = {
  themeColor: "#0c1738",
  colorScheme: "dark",
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
      className={`${manrope.variable} ${spaceGrotesk.variable} h-full antialiased`}
    >
      <body className="relative flex min-h-[100dvh] flex-col">
        {/* Fixed decorative backdrop: deep-night navy with bright fireworks up top. */}
        <div className="app-bg" aria-hidden="true">
          <Fireworks className="pointer-events-none absolute inset-x-0 top-0" />
        </div>
        {children}
      </body>
    </html>
  );
}
