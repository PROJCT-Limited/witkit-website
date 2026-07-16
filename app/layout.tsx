import "./globals.css";
import { fontDisplay, fontMono } from "./fonts";

export const metadata = {
  title: "wit kit",
  description:
    "Made-to-order furniture, configured by you. wit kit is a small-batch object maker — design your own table, stool, or shelf and preorder it directly.",
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${fontDisplay.variable} ${fontMono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
