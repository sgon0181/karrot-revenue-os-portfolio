import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Karrot Revenue OS",
    template: "%s | Karrot Revenue OS",
  },
  description: "A source-backed commercial workspace for Australian aged-care growth teams.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" data-scroll-behavior="smooth">
      <body>{children}</body>
    </html>
  );
}
