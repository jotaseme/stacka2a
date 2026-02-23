import type { Metadata } from "next";
import { DM_Sans, JetBrains_Mono } from "next/font/google";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import "./globals.css";

const dmSans = DM_Sans({
  variable: "--font-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://stacka2a.dev"),
  title: {
    default: "StackA2A — The best A2A agents, scored & ready to connect",
    template: "%s | StackA2A",
  },
  description:
    "Curated directory of A2A (Agent-to-Agent) protocol agents with quality scores, capability badges, and connection snippets for Python, TypeScript, Java, Go, and C#.",
  openGraph: {
    type: "website",
    locale: "en_US",
    siteName: "StackA2A",
    title: "StackA2A — The best A2A agents, scored & ready to connect",
    description:
      "Curated directory of A2A protocol agents with quality scores and connection snippets for every SDK.",
    images: [{ url: "/opengraph-image.png", width: 1200, height: 630 }],
  },
  twitter: {
    card: "summary_large_image",
    title: "StackA2A — The best A2A agents, scored & ready to connect",
    description:
      "Curated directory of A2A protocol agents with quality scores and connection snippets for every SDK.",
  },
  alternates: {
    canonical: "https://stacka2a.dev",
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
        <script
          defer
          src="https://cloud.umami.is/script.js"
          data-website-id="7626b59d-9dde-4dc5-b35f-bc644dfd5e32"
        />
      </head>
      <body
        className={`${dmSans.variable} ${jetbrainsMono.variable} font-sans antialiased bg-background text-text-primary`}
      >
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "WebSite",
              name: "StackA2A",
              url: "https://stacka2a.dev",
              description:
                "Curated directory of A2A protocol agents with quality scores and connection snippets.",
              potentialAction: {
                "@type": "SearchAction",
                target: "https://stacka2a.dev/agents?q={search_term_string}",
                "query-input": "required name=search_term_string",
              },
            }),
          }}
        />
        <Header />
        <main className="min-h-[calc(100vh-3.5rem)]">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
